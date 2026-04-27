import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Inbox, CalendarDays, Users, MapPin } from "lucide-react";
import Navbar from "../../components/Navbar";
import SiteFooter from "../../components/SiteFooter";
import { ApiError, apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import Skeleton from "../../components/Skeleton";

type Listing = {
  listingId: string;
  title: string;
  colony: string;
  city: string;
  monthlyRent: number;
  maxOccupants: number;
  furnishingName: string;
  availableFrom: string;
  statusId: number;
  coverPhotoUrl: string | null;
};

type TenantConnection = {
  connectionId: string;
  tenantName: string;
  listingTitle: string;
  monthlyRent: number;
  status: "Pending" | "Accepted" | "Rejected";
  requestedAt: string;
  finalDealAmount?: number;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [connections, setConnections] = useState<TenantConnection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [processingConnectionId, setProcessingConnectionId] = useState<string | null>(null);
  
  // Deal amount dialog state
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<TenantConnection | null>(null);
  const [dealAmount, setDealAmount] = useState<string>("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [listingsRes, connectionsRes] = await Promise.all([
          apiFetch<{ listings: Listing[] }>("/api/listings/mine", { method: "GET" }),
          apiFetch<{ items: TenantConnection[] }>("/api/connections/landlord", { method: "GET" }).catch(
            () => ({ items: [] }),
          ),
        ]);

        if (!active) return;
        setItems(Array.isArray(listingsRes.listings) ? listingsRes.listings : []);
        setConnections(Array.isArray(connectionsRes.items) ? connectionsRes.items : []);
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          await logout();
          navigate("/login", { replace: true });
          return;
        }
        setErrorMsg(error instanceof Error ? error.message : "Failed to load your properties");
      } finally {
        if (active) {
          setLoading(false);
          setConnectionsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [logout, navigate]);

  const handleAcceptRequest = async (connection: TenantConnection) => {
    setSelectedConnection(connection);
    setDealAmount(connection.monthlyRent.toString());
    setDealDialogOpen(true);
  };

  const handleConfirmDeal = async () => {
    if (!selectedConnection || !dealAmount) return;
    
    setProcessingConnectionId(selectedConnection.connectionId);
    try {
      await apiFetch(`/api/connections/${selectedConnection.connectionId}/deal-done`, { 
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalAmount: Number(dealAmount) })
      });
      
      setConnections((prev) =>
        prev.map((conn) =>
          conn.connectionId === selectedConnection.connectionId 
            ? { ...conn, status: "Accepted" as const, finalDealAmount: Number(dealAmount) } 
            : conn
        )
      );
      
      showToast(`Deal confirmed for ₹${Number(dealAmount).toLocaleString("en-IN")}/month`, "success");
      setDealDialogOpen(false);
      setSelectedConnection(null);
      setDealAmount("");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to confirm deal", "error");
    } finally {
      setProcessingConnectionId(null);
    }
  };

  const handleRejectRequest = async (connectionId: string) => {
    setProcessingConnectionId(connectionId);
    try {
      await apiFetch(`/api/connections/${connectionId}/deal-close`, { method: "PATCH" });
      setConnections((prev) =>
        prev.map((conn) =>
          conn.connectionId === connectionId ? { ...conn, status: "Rejected" as const } : conn
        )
      );
      showToast("Tenant request rejected", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to reject request", "error");
    } finally {
      setProcessingConnectionId(null);
    }
  };

  const handleDelete = async (listingId: string) => {
    setDeletingId(listingId);
    try {
      await apiFetch(`/api/listings/${listingId}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.listingId !== listingId));
      showToast("Property deleted", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to delete property", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const activeCount = items.length;

  return (
    <div className="app-shell">
      <Navbar />

      {/* Deal Amount Dialog */}
      {dealDialogOpen && selectedConnection && (
        <div className="modal-overlay" onClick={() => setDealDialogOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Deal Amount</h3>
              <button 
                className="modal-close-btn" 
                onClick={() => setDealDialogOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div style={{ marginBottom: 20 }}>
                <p style={{ marginBottom: 8 }}>
                  <strong>{selectedConnection.tenantName}</strong> wants to connect for:
                </p>
                <p style={{ color: "var(--slate-600)" }}>{selectedConnection.listingTitle}</p>
              </div>
              
              <div style={{ marginBottom: 24 }}>
                <label className="field-label">Final Deal Amount (₹/month)</label>
                <div style={{ position: "relative" }}>
                  <span style={{ 
                    position: "absolute", 
                    left: "12px", 
                    top: "50%", 
                    transform: "translateY(-50%)",
                    color: "var(--slate-600)",
                    fontWeight: 600
                  }}>₹</span>
                  <input
                    type="number"
                    className="input-style"
                    value={dealAmount}
                    onChange={(e) => setDealAmount(e.target.value)}
                    placeholder="Enter final amount"
                    style={{ paddingLeft: "32px" }}
                    min="1000"
                    step="500"
                  />
                </div>
                <p style={{ 
                  fontSize: "0.85rem", 
                  color: "var(--slate-600)", 
                  marginTop: 8 
                }}>
                  Original price: ₹{selectedConnection.monthlyRent.toLocaleString("en-IN")}/month
                </p>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn btn-ghost"
                onClick={() => setDealDialogOpen(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleConfirmDeal}
                disabled={!dealAmount || Number(dealAmount) < 1000 || processingConnectionId === selectedConnection.connectionId}
              >
                {processingConnectionId === selectedConnection.connectionId ? "Confirming..." : "Confirm Deal"}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="page-shell">
        <section className="page-section">
          <div className="page-container">
            <div className="dashboard-hero">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "start", flexWrap: "wrap" }}>
                <div>
                  <p className="eyebrow" style={{ marginBottom: 10 }}>Owner Dashboard</p>
                  <h1 style={{ fontSize: "3rem", lineHeight: 1.05, marginBottom: 10 }}>My Properties</h1>
                  <p>Manage listings and respond to tenant requests.</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate("/post-property")}>
                  <Plus size={18} />
                  Post New
                </button>
              </div>

              <div className="dashboard-metrics">
                <div className="metric-card">
                  <span>Active</span>
                  <strong style={{ color: "var(--green-500)" }}>{activeCount}</strong>
                </div>
                <div className="metric-card">
                  <span>Views (30d)</span>
                  <strong>{activeCount ? "1,284" : "0"}</strong>
                </div>
                <div className="metric-card">
                  <span>Requests</span>
                  <strong>{connections.filter((item) => item.status === "Pending").length}</strong>
                </div>
                <div className="metric-card">
                  <span>Rating</span>
                  <strong>{activeCount ? "4.8" : "0.0"}</strong>
                </div>
              </div>
            </div>

            {errorMsg ? <div className="error-banner">{errorMsg}</div> : null}

            <div className="listing-grid" style={{ marginBottom: 24 }}>
              {loading ? (
                <>
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={`dashboard-skeleton-${index}`} className="surface-card dashboard-property-card">
                      <Skeleton style={{ height: 360, borderRadius: 24 }} />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {items.length > 0 ? (
                    items.map((item) => (
                      <article key={item.listingId} className="listing-card">
                        <div className="listing-card-image dot-grid">
                          <div className="listing-card-badges">
                            <div className="listing-card-badges-left">
                              <span className="badge badge-verified">Active</span>
                            </div>
                          </div>
                          {item.coverPhotoUrl ? (
                            <img src={item.coverPhotoUrl} alt={item.title} />
                          ) : (
                            <div className="listing-card-placeholder">
                              <Inbox size={66} />
                              <span style={{ fontWeight: 700 }}>NO IMAGE YET</span>
                            </div>
                          )}
                        </div>

                        <div className="listing-card-content">
                          <div className="listing-card-price">
                            ₹{item.monthlyRent.toLocaleString("en-IN")}
                            <span>/month</span>
                          </div>
                          <h3 className="listing-card-title">{item.title}</h3>
                          <div className="listing-card-location">
                            <MapPin size={16} />
                            {item.colony}, {item.city}
                          </div>
                          <div className="listing-card-meta" style={{ marginBottom: 18 }}>
                            <span className="listing-card-meta-item">
                              <Users size={14} />
                              {item.maxOccupants} occupants
                            </span>
                            <span className="listing-card-meta-item">
                              <CalendarDays size={14} />
                              {new Date(item.availableFrom).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 10 }}>
                            <button className="btn btn-dark btn-block" onClick={() => navigate(`/listings/${item.listingId}`)}>
                              <Pencil size={16} />
                              Edit
                            </button>
                            <button
                              className="btn btn-outline"
                              style={{ color: "var(--red-500)", borderColor: "rgba(255,95,87,0.3)" }}
                              onClick={() => void handleDelete(item.listingId)}
                              disabled={deletingId === item.listingId}
                            >
                              <Trash2 size={16} />
                              Delete
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="empty-dashed-card">
                      <div>
                        <div className="feature-icon" style={{ margin: "0 auto 18px" }}>
                          <Plus size={22} />
                        </div>
                        <h3 style={{ marginBottom: 6 }}>Post your first property</h3>
                        <p style={{ marginBottom: 18 }}>It's free and takes 3 minutes</p>
                        <button className="btn btn-primary" onClick={() => navigate("/post-property")}>
                          <Plus size={16} />
                          Post Property
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="empty-dashed-card">
                    <div>
                      <div className="feature-icon" style={{ margin: "0 auto 18px" }}>
                        <Plus size={22} />
                      </div>
                      <h3 style={{ marginBottom: 6 }}>Post another property</h3>
                      <p>It's free and takes 3 minutes</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="surface-card tenant-requests-card">
              <h2 style={{ fontSize: "2rem", marginBottom: 6 }}>Tenant Requests</h2>
              <p style={{ marginBottom: 24 }}>
                Tenants who want to connect with you. Confirm a deal to let them leave a review.
              </p>

              {connectionsLoading ? (
                <Skeleton style={{ height: 220, borderRadius: 20 }} />
              ) : connections.length === 0 ? (
                <div className="request-empty">
                  <div>
                    <Inbox size={48} style={{ color: "var(--slate-600)", marginBottom: 14 }} />
                    <h3 style={{ marginBottom: 8 }}>No tenant requests yet</h3>
                    <p>When tenants reach out, you'll see them here.</p>
                  </div>
                </div>
              ) : (
                <div className="checkbox-stack">
                  {connections.map((connection) => (
                    <div key={connection.connectionId} className="surface-card" style={{ padding: 18, borderRadius: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: "1.05rem", marginBottom: 6 }}>{connection.tenantName}</h3>
                          <p style={{ marginBottom: 4 }}>{connection.listingTitle}</p>
                          {connection.status === "Accepted" && connection.finalDealAmount && (
                            <p style={{ 
                              fontSize: "0.9rem", 
                              color: "var(--green-500)", 
                              fontWeight: 600,
                              marginTop: 6 
                            }}>
                              Deal Amount: ₹{connection.finalDealAmount.toLocaleString("en-IN")}/month
                            </p>
                          )}
                        </div>
                        
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                          <span className={`badge ${
                            connection.status === "Accepted" ? "badge-verified" : connection.status === "Rejected" ? "badge-dark" : "badge-soft"
                          }`}>
                            {connection.status}
                          </span>
                          
                          {connection.status === "Pending" && (
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => void handleAcceptRequest(connection)}
                                disabled={processingConnectionId === connection.connectionId}
                              >
                                {processingConnectionId === connection.connectionId ? "Processing..." : "Accept"}
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => void handleRejectRequest(connection.connectionId)}
                                disabled={processingConnectionId === connection.connectionId}
                              >
                                {processingConnectionId === connection.connectionId ? "Rejecting..." : "Reject"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

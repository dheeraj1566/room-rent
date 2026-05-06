import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Inbox, CalendarDays, Users, MapPin, Eye, EyeOff } from "lucide-react";
import Navbar from "../../components/Navbar";
import SiteFooter from "../../components/SiteFooter";
import { ApiError, apiFetch } from "../../lib/api";
import { syncTenantRequestNotifications } from "../../lib/notifications";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import Skeleton from "../../components/Skeleton";
import "./Dashboard.css";

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
  statusName: string;
  coverPhotoUrl: string | null;
};

type TenantConnection = {
  connectionId: string;
  tenantName: string;
  listingTitle: string;
  monthlyRent: number;
  maxOccupants: number;
  requestedOccupants?: number | null;
  rentPayments?: {
    month: string;
    paymentStatus: "OnTime" | "Late";
    markedAt: string;
    updateCount?: number;
    paymentSlipUrl?: string;
    paymentSlipBlobId?: string;
  }[];
  status: "Pending" | "Accepted" | "Rejected";
  requestedAt: string;
  finalDealAmount?: number;
};

const getCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { logout } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [connections, setConnections] = useState<TenantConnection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);
  const [processingConnectionId, setProcessingConnectionId] = useState<string | null>(null);
  const [rentSlipFileByConnection, setRentSlipFileByConnection] = useState<Record<string, File | null>>({});
  
  // Deal amount dialog state
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<TenantConnection | null>(null);
  const [dealAmount, setDealAmount] = useState<string>("");
  const focusedRequestId = searchParams.get("request");

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

  useEffect(() => {
    const pendingNotifications = connections
      .filter((connection) => connection.status === "Pending")
      .map((connection) => ({
        id: connection.connectionId,
        connectionId: connection.connectionId,
        tenantName: connection.tenantName,
        listingTitle: connection.listingTitle,
        status: connection.status,
        requestedAt: connection.requestedAt,
      }));

    syncTenantRequestNotifications(pendingNotifications);
  }, [connections]);

  useEffect(() => {
    if (!focusedRequestId || connectionsLoading) return;

    const element = document.getElementById(`tenant-request-${focusedRequestId}`);
    if (!element) return;

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("request");
      setSearchParams(nextParams, { replace: true });
    }, 800);
  }, [focusedRequestId, connectionsLoading, connections, searchParams, setSearchParams]);

  const pendingRequestCount = useMemo(
    () => connections.filter((item) => item.status === "Pending").length,
    [connections]
  );

  const handleAcceptRequest = async (connection: TenantConnection) => {
    // Validate occupant requirement if specified
    if (connection.requestedOccupants && connection.requestedOccupants > connection.maxOccupants) {
      showToast(
        `Cannot accept: Tenant needs ${connection.requestedOccupants} occupant(s) but room capacity is only ${connection.maxOccupants}`,
        "error"
      );
      return;
    }

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

  const handleToggleStatus = async (listingId: string) => {
    setTogglingStatusId(listingId);
    try {
      const data = await apiFetch<{ status: string }>(`/api/listings/${listingId}/status`, { method: "PATCH" });
      setItems((prev) =>
        prev.map((item) =>
          item.listingId === listingId
            ? { ...item, statusName: data.status, statusId: data.status === "Active" ? 1 : 2 }
            : item
        )
      );
      showToast(data.status === "Active" ? "Listing is now visible" : "Listing is now hidden", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to update status", "error");
    } finally {
      setTogglingStatusId(null);
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
  const currentMonth = useMemo(() => getCurrentMonth(), []);
  const currentMonthLabel = useMemo(
    () => new Date(`${currentMonth}-01`).toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
    [currentMonth]
  );

  const renderOccupants = (count: number, keyPrefix: string) => (
    <>
      <span className="occupant-icon-group" aria-hidden="true">
        {Array.from({ length: Math.min(Math.max(count, 1), 4) }, (_, index) => (
          <Users key={`${keyPrefix}-${index}`} size={14} />
        ))}
      </span>
      <span>{count} {count === 1 ? "occupant" : "occupants"}</span>
    </>
  );

  const handleRentPaymentUpdate = async (
    connection: TenantConnection,
    paymentStatus: "OnTime" | "Late"
  ) => {
    const month = currentMonth;
    setProcessingConnectionId(connection.connectionId);
    try {
      let paymentSlipUrl: string | undefined;
      let paymentSlipBlobId: string | undefined;

      const slipFile = rentSlipFileByConnection[connection.connectionId];
      if (slipFile) {
        const formData = new FormData();
        formData.append("image", slipFile);
        const upload = await apiFetch<{ url: string; blobId: string }>("/api/uploads/image", {
          method: "POST",
          body: formData,
        });
        paymentSlipUrl = upload.url;
        paymentSlipBlobId = upload.blobId;
      }

      const response = await apiFetch<{ rentPayments: TenantConnection["rentPayments"] }>(
        `/api/connections/${connection.connectionId}/rent-payment`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, paymentStatus, paymentSlipUrl, paymentSlipBlobId }),
        }
      );

      setConnections((prev) =>
        prev.map((conn) =>
          conn.connectionId === connection.connectionId
            ? { ...conn, rentPayments: response.rentPayments ?? [] }
            : conn
        )
      );

      setRentSlipFileByConnection((prev) => ({
        ...prev,
        [connection.connectionId]: null,
      }));

      showToast(
        `${connection.tenantName}'s ${month} rent marked as ${paymentStatus === "OnTime" ? "On Time" : "Late"}`,
        "success"
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to update rent status", "error");
    } finally {
      setProcessingConnectionId(null);
    }
  };

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
              <div className="dashboard-modal-section">
                <p className="dashboard-modal-section-title">
                  <strong>{selectedConnection.tenantName}</strong> wants to connect for:
                </p>
                <p className="dashboard-modal-listing-title">{selectedConnection.listingTitle}</p>
              </div>
              
              <div className="dashboard-deal-section">
                <label className="field-label">Final Deal Amount (₹/month)</label>
                <div className="dashboard-deal-input-wrapper">
                  <span className="dashboard-deal-currency">₹</span>
                  <input
                    type="number"
                    value={dealAmount}
                      className="input-style dashboard-modal-span-text"
                      onChange={(e) => setDealAmount(e.target.value)}
                    placeholder="Enter final amount"
                    min="1000"
                    step="500"
                  />
                </div>
                <p className="dashboard-deal-note">
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
              <div className="dashboard-header">
                <div>
                  <p className="eyebrow">Owner Dashboard</p>
                  <h1 className="dashboard-section-title">My Properties</h1>
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
                  <strong className="dashboard-stat-value">{activeCount}</strong>
                </div>
                <div className="metric-card">
                  <span>Requests</span>
                  <strong>{pendingRequestCount}</strong>
                </div>
              </div>
            </div>

            {errorMsg ? <div className="error-banner">{errorMsg}</div> : null}

            <div className="listing-grid dashboard-listings-section">
              {loading ? (
                <>
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={`dashboard-skeleton-${index}`} className="surface-card dashboard-property-card">
                      <Skeleton className="dashboard-listing-skeleton" />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {items.length > 0 ? (
                    items.map((item) => (
                      <article key={item.listingId} className="listing-card listing-card-wrapper dashboard-listing-card">
                        <div className={`listing-card-image-wrapper dot-grid dashboard-listing-image-wrap${item.statusName !== "Active" ? " listing-card-image--dimmed" : ""}`}>
                          <div className="listing-card-badges">
                            <div className="listing-card-badges-left">
                              <span className={`badge ${item.statusName === "Active" ? "badge-verified" : "badge-soft"}`}>
                                {item.statusName === "Active" ? "Visible" : "Hidden"}
                              </span>
                            </div>
                          </div>
                          {item.coverPhotoUrl ? (
                            <img src={item.coverPhotoUrl} alt={item.title} className={`listing-card-image dashboard-listing-image ${item.statusName !== "Active" ? "inactive" : ""}`} />
                          ) : (
                            <div className="listing-card-placeholder">
                              <Inbox size={66} />
                              <span className="dashboard-listing-no-image">NO IMAGE YET</span>
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
                          <div className="dashboard-listing-meta">
                            <span className="listing-card-meta-item">
                              {renderOccupants(item.maxOccupants, item.listingId)}
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
                          <div className="dashboard-listing-actions">
                            <button
                              className="btn btn-outline btn-sm dashboard-listing-action-fixed"
                              title={item.statusName === "Active" ? "Hide listing" : "Show listing"}
                              onClick={() => void handleToggleStatus(item.listingId)}
                              disabled={togglingStatusId === item.listingId}
                            >
                              {item.statusName === "Active" ? <EyeOff size={15} /> : <Eye size={15} />}
                              {togglingStatusId === item.listingId ? "..." : item.statusName === "Active" ? "Hide" : "Show"}
                            </button>
                            <button className="btn btn-dark btn-sm dashboard-listing-action-edit" onClick={() => navigate(`/listings/${item.listingId}`)}>
                              <Pencil size={15} />
                              Edit
                            </button>
                            <button
                              className="btn btn-outline btn-sm dashboard-listing-delete-btn"
                              onClick={() => void handleDelete(item.listingId)}
                              disabled={deletingId === item.listingId}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="empty-dashed-card">
                      <div>
                        <div className="feature-icon dashboard-empty-state-icon">
                          <Plus size={22} />
                        </div>
                        <h3 className="dashboard-empty-state-title">Post your first property</h3>
                        <p className="dashboard-empty-state-desc">It's free and takes 3 minutes</p>
                        <button className="btn btn-primary" onClick={() => navigate("/post-property")}>
                          <Plus size={16} />
                          Post Property
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="empty-dashed-card">
                    <div>
                      <div className="feature-icon dashboard-empty-state-icon">
                        <Plus size={22} />
                      </div>
                      <h3 className="dashboard-empty-state-title">Post another property</h3>
                      <p>It's free and takes 3 minutes</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="surface-card tenant-requests-card">
              <h2 className="dashboard-section-title">Tenant Requests</h2>
              <p className="dashboard-section-subtitle">
                Tenants who want to connect with you. Confirm a deal to let them leave a review.
              </p>

              {connectionsLoading ? (
                <Skeleton className="dashboard-requests-skeleton" />
              ) : connections.length === 0 ? (
                <div className="request-empty">
                  <div>
                    <Inbox size={48} className="dashboard-requests-empty-icon" />
                    <h3 className="dashboard-requests-empty-title">No tenant requests yet</h3>
                    <p>When tenants reach out, you'll see them here.</p>
                  </div>
                </div>
              ) : (
                <div className="checkbox-stack">
                  {connections.map((connection) => (
                    <div
                      id={`tenant-request-${connection.connectionId}`}
                      key={connection.connectionId}
                      className={`surface-card dashboard-request-item${focusedRequestId === connection.connectionId ? " is-focused" : ""}`}
                    >
                      <div className="tenant-request-row">
                        <div className="tenant-request-main">
                          <h3 className="dashboard-request-tenantname">{connection.tenantName}</h3>
                          <p className="dashboard-request-listingtitle">{connection.listingTitle}</p>
                          
                          {/* Occupant Information */}
                          <div className="tenant-request-meta">
                            <span className="dashboard-request-occupants">
                              <Users size={16} className="dashboard-request-occupants-icon" />
                              Room Capacity: {connection.maxOccupants}
                            </span>
                            {connection.requestedOccupants ? (
                              <span className="dashboard-request-occupants-count">
                                {connection.requestedOccupants > connection.maxOccupants ? "⚠ " : ""}
                                Requested: {connection.requestedOccupants}
                              </span>
                            ) : (
                              <span className="dashboard-request-preference-tag">
                                Requested: Not specified
                              </span>
                            )}
                          </div>

                          {connection.status === "Accepted" && connection.finalDealAmount && (
                            <p className="dashboard-deal-amount">
                              Deal Amount: ₹{connection.finalDealAmount.toLocaleString("en-IN")}/month
                            </p>
                          )}

                          {connection.status === "Accepted" && (
                            <div className="rent-tracking-panel">
                              <p className="dashboard-rent-tracking-title">
                                Monthly Rent Tracking
                              </p>

                              <div className="rent-tracking-controls">
                                <span className="rent-current-month-chip">
                                  {currentMonthLabel}
                                </span>
                                <label className="btn btn-outline btn-sm rent-slip-upload-btn">
                                  Upload Slip
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="dashboard-modal-input-hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] ?? null;
                                      setRentSlipFileByConnection((prev) => ({
                                        ...prev,
                                        [connection.connectionId]: file,
                                      }));
                                    }}
                                  />
                                </label>
                                <button
                                  className="btn btn-sm dashboard-rent-ontime-btn"
                                  onClick={() => void handleRentPaymentUpdate(connection, "OnTime")}
                                  disabled={processingConnectionId === connection.connectionId}
                                >
                                  Mark On Time
                                </button>
                                <button
                                  className="btn btn-sm dashboard-rent-late-btn"
                                  onClick={() => void handleRentPaymentUpdate(connection, "Late")}
                                  disabled={processingConnectionId === connection.connectionId}
                                >
                                  Mark Late
                                </button>
                              </div>

                              {rentSlipFileByConnection[connection.connectionId] ? (
                                <p className="dashboard-rent-slip-info">
                                  Selected slip: {rentSlipFileByConnection[connection.connectionId]?.name}
                                </p>
                              ) : null}

                              {Array.isArray(connection.rentPayments) && connection.rentPayments.length > 0 ? (
                                <div className="rent-history-list">
                                  {connection.rentPayments.slice(0, 6).map((entry) => (
                                    <span
                                      key={`${connection.connectionId}-${entry.month}`}
                                      className={`badge ${entry.paymentStatus === "OnTime" ? "dashboard-rent-ontime-badge" : "dashboard-rent-late-badge"}`}
                                    >
                                      {entry.month}: {entry.paymentStatus === "OnTime" ? "On Time" : "Late"}
                                      {entry.paymentSlipUrl ? " • Slip" : ""}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="dashboard-rent-no-records">
                                  No monthly rent records yet.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="tenant-request-actions">
                          <span className={`badge ${
                            connection.status === "Accepted" ? "badge-verified" : connection.status === "Rejected" ? "badge-dark" : "badge-soft"
                          }`}>
                            {connection.status}
                          </span>
                          
                          {connection.status === "Pending" && (
                            <div className="tenant-request-buttons">
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => void handleAcceptRequest(connection)}
                                disabled={processingConnectionId === connection.connectionId || (connection.requestedOccupants ? connection.requestedOccupants > connection.maxOccupants : false)}
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

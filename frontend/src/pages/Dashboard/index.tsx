import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const loadMine = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await apiFetch<{ listings: Listing[] }>("/api/listings/mine", { method: "GET" });
      setItems(Array.isArray(data.listings) ? data.listings : []);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }
      setErrorMsg(error instanceof Error ? error.message : "Failed to load your listings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMine();
  }, []);

  return (
    <>
      <Navbar />
      <div className="listings-container">
        <div className="glass-card" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginBottom: "0.25rem" }}>My Properties</h2>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            Open any listing to edit details.
          </p>
        </div>

        {errorMsg && (
          <div className="glass-card text-center" style={{ color: "#ef4444", marginBottom: "1rem" }}>
            {errorMsg}
          </div>
        )}

        <div className="listings-grid">
          {loading
            ? Array.from({ length: 6 }).map((_, idx) => (
                <div key={`my-listing-skeleton-${idx}`} className="listing-card" style={{ padding: 0, overflow: "hidden" }}>
                  <Skeleton style={{ width: "100%", aspectRatio: "4 / 3" }} />
                  <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <Skeleton style={{ width: "65%", height: 20 }} />
                    <Skeleton style={{ width: "45%", height: 18 }} />
                    <Skeleton style={{ width: "85%", height: 18 }} />
                  </div>
                </div>
              ))
            : items.map((item) => (
                <div key={item.listingId} className="listing-card">
                  <div className="listing-card-image">
                    {item.coverPhotoUrl ? (
                      <img src={item.coverPhotoUrl} alt={item.title} />
                    ) : (
                      <div className="listing-card-placeholder">No Image</div>
                    )}
                  </div>
                  <div className="listing-card-content">
                    <div className="listing-card-price">
                      ₹{Number(item.monthlyRent).toLocaleString("en-IN")}
                      <span className="listing-card-price-label"> /month</span>
                    </div>
                    <h3 className="listing-card-title">{item.title}</h3>
                    <p className="listing-card-location">
                      {item.colony}, {item.city}
                    </p>
                    <p style={{ margin: "0 0 0.75rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                      {item.furnishingName} • {item.maxOccupants} occupants • Available{" "}
                      {new Date(item.availableFrom).toLocaleDateString("en-IN")}
                    </p>
                    <button
                      className="btn btn-primary w-full"
                      onClick={() => navigate(`/listings/${item.listingId}`)}
                    >
                      Edit Property
                    </button>
                  </div>
                </div>
              ))}
        </div>

        {!loading && !errorMsg && items.length === 0 && (
          <div className="glass-card text-center" style={{ marginTop: "1rem" }}>
            You have not listed any property yet.
          </div>
        )}
      </div>
    </>
  );
}

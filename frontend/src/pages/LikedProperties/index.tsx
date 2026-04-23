import { useEffect, useState } from "react";
import { Heart, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import SiteFooter from "../../components/SiteFooter";
import { apiFetch } from "../../lib/api";
import Skeleton from "../../components/Skeleton";

type FavoriteItem = {
  listingId: string;
  title: string;
  coverPhotoUrl: string | null;
};

export default function LikedPropertiesPage() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ items: FavoriteItem[] }>("/api/favorites", { method: "GET" })
      .then((data) => setFavorites(Array.isArray(data.items) ? data.items : []))
      .catch(() => setFavorites([]))
      .finally(() => setFavoritesLoading(false));
  }, []);

  return (
    <div className="app-shell">
      <Navbar />
      <main className="page-shell">
        <section className="page-section">
          <div className="page-container">
            <div className="profile-hero">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <p className="eyebrow" style={{ marginBottom: 12 }}>Saved Homes</p>
                  <h1 style={{ fontSize: "3rem", lineHeight: 1.05, marginBottom: 10 }}>Liked Properties</h1>
                  <p>{favorites.length} properties saved to your wishlist.</p>
                </div>
                <button className="btn btn-outline btn-sm" type="button" onClick={() => navigate("/profile")}>
                  Back to Profile
                </button>
              </div>
            </div>

            <div className="surface-card liked-properties-card">
              {favoritesLoading ? (
                <Skeleton style={{ height: 280, borderRadius: 22 }} />
              ) : favorites.length === 0 ? (
                <div className="request-empty">
                  <div>
                    <Home size={48} style={{ color: "var(--slate-600)", marginBottom: 14 }} />
                    <h3 style={{ marginBottom: 8 }}>You haven't liked any properties yet</h3>
                    <p>Tap the heart on any listing to save it here.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                    <Heart size={20} fill="currentColor" style={{ color: "#ef4444" }} />
                    <h2 style={{ fontSize: "1.65rem" }}>All Liked Properties</h2>
                  </div>
                  <div className="listing-grid">
                    {favorites.map((favorite) => (
                      <article
                        key={favorite.listingId}
                        className="listing-card"
                        onClick={() => navigate(`/listings/${favorite.listingId}`)}
                      >
                        <div className="listing-card-image">
                          {favorite.coverPhotoUrl ? (
                            <img src={favorite.coverPhotoUrl} alt={favorite.title} />
                          ) : (
                            <div className="listing-card-placeholder">
                              <Home size={66} />
                              <span style={{ fontWeight: 700 }}>NO IMAGE YET</span>
                            </div>
                          )}
                        </div>
                        <div className="listing-card-content">
                          <h3 className="listing-card-title">{favorite.title}</h3>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

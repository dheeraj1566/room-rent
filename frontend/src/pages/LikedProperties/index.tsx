import { useEffect, useState } from "react";
import { Heart, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./LikedProperties.css";
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
  const [unlikingIds, setUnlikingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiFetch<{ items: FavoriteItem[] }>("/api/favorites", { method: "GET" })
      .then((data) => setFavorites(Array.isArray(data.items) ? data.items : []))
      .catch(() => setFavorites([]))
      .finally(() => setFavoritesLoading(false));
  }, []);

  const handleToggleFavorite = async (listingId: string) => {
    if (unlikingIds.has(listingId)) return;

    setUnlikingIds((prev) => new Set(prev).add(listingId));
    try {
      const data = await apiFetch<{ liked: boolean }>(`/api/favorites/${listingId}`, { method: "POST" });
      if (!data.liked) {
        setFavorites((prev) => prev.filter((favorite) => favorite.listingId !== listingId));
      }
    } catch {
      // Keep current UI state when the toggle request fails.
    } finally {
      setUnlikingIds((prev) => {
        const next = new Set(prev);
        next.delete(listingId);
        return next;
      });
    }
  };

  return (
    <div className="app-shell">
      <Navbar />
      <main className="page-shell">
        <section className="page-section">
          <div className="page-container">
            <div className="profile-hero">
              <div className="liked-properties-header">
                <div className="liked-properties-header-content">
                  <p className="eyebrow">Saved Homes</p>
                  <h1 className="liked-properties-header-title">Liked Properties</h1>
                  <p>{favorites.length} properties saved to your wishlist.</p>
                </div>
                <button className="btn btn-outline btn-sm" type="button" onClick={() => navigate("/profile")}>
                  Back to Profile
                </button>
              </div>
            </div>

            <div className="surface-card liked-properties-card">
              {favoritesLoading ? (
                <Skeleton className="liked-properties-skeleton" />
              ) : favorites.length === 0 ? (
                <div className="request-empty">
                  <div>
                    <Home size={48} className="liked-properties-empty-icon" />
                    <h3 className="liked-properties-empty-title">You haven't liked any properties yet</h3>
                    <p>Tap the heart on any listing to save it here.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="liked-properties-all-header">
                    <Heart size={20} fill="currentColor" className="liked-properties-header-icon" />
                    <h2 className="liked-properties-all-title">All Liked Properties</h2>
                  </div>
                  <div className="liked-properties-grid">
                    {favorites.map((favorite) => (
                      <article
                        key={favorite.listingId}
                        className="listing-card liked-properties-grid-item"
                        onClick={() => navigate(`/listings/${favorite.listingId}`)}
                      >
                        <button
                          type="button"
                          className="listing-card-favorite active liked-properties-unlike-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleFavorite(favorite.listingId);
                          }}
                          aria-label="Remove from favorites"
                          disabled={unlikingIds.has(favorite.listingId)}
                        >
                          <Heart size={18} fill="currentColor" />
                        </button>

                        <div className="listing-card-image liked-properties-image-wrap">
                          {favorite.coverPhotoUrl ? (
                            <img src={favorite.coverPhotoUrl} alt={favorite.title} />
                          ) : (
                            <div className="listing-card-placeholder">
                              <Home size={66} />
                              <span className="liked-properties-no-image">NO IMAGE YET</span>
                            </div>
                          )}
                        </div>
                        <div className="listing-card-content liked-properties-card-content">
                          <h3 className="listing-card-title">{favorite.title}</h3>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm liked-properties-unlike-inline"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleToggleFavorite(favorite.listingId);
                            }}
                            disabled={unlikingIds.has(favorite.listingId)}
                          >
                            {unlikingIds.has(favorite.listingId) ? "Removing..." : "Unlike"}
                          </button>
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

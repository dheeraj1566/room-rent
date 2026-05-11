import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import brandLogo from "../../assets/Roombaazi Final Logo.png";
import {
  Search,
  Shield,
  Zap,
  Heart,
  ArrowRight,
  Star,
  MapPin,
} from "lucide-react";
import SiteFooter from "../../components/SiteFooter";
import ListingCard from "../../components/ListingCard";
import Skeleton from "../../components/Skeleton";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import "./Home.css";

type Listing = {
  listingId: string;
  title: string;
  colony: string;
  city: string;
  monthlyRent: number;
  rentTiers: { occupants: number; rent: number }[];
  maxOccupants: number;
  roomCategoryName: string;
  landlordGender: string | null;
  roomFor: string | null;
  propertyTypeId: number | null;
  furnishingName: string;
  foodPreferenceName?: string;
  coverPhotoUrl: string | null;
  createdAt?: string;
};

type ListingsResponse = {
  items: Listing[];
};

const popularAreas = ["Pratap Nagar", "Mansarovar", "Vaishali Nagar", "Malviya Nagar"];

export default function Home() {
  const [search, setSearch] = useState("");
  const [featured, setFeatured] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    let active = true;

    apiFetch<ListingsResponse>("/api/listings?page=1&limit=3&sortBy=newest", {
      method: "GET",
    })
      .then((data) => {
        if (!active) return;
        setFeatured(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        if (!active) return;
        setFeatured([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    navigate(`/browse?${params.toString()}`);
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="app-shell">
      <main className="page-shell">
        <section className="hero-panel dot-grid hero-gradient">
          <div className="page-container home-hero">
            <div>
              <div className="home-header-nav">
                <img className="home-header-logo" src={brandLogo} alt="Roombaazi" />
                <div className="home-header-actions">
                  {user ? (
                    <button type="button" className="btn btn-outline" onClick={() => void handleLogout()}>
                      Logout
                    </button>
                  ) : (
                    <>
                      <Link to="/login" className="btn btn-outline">
                        Login
                      </Link>
                      <Link to="/register" className="btn btn-dark">
                        Register
                      </Link>
                    </>
                  )}
                </div>
              </div>
              <span className="badge badge-soft">
                <Star size={14} fill="currentColor" />
                Trusted by 50,000+ renters
              </span>
              <h1 className="section-title home-title">
                Find your next home,
                <br />
                <span className="accent">without the broker</span>
              </h1>
              <p className="section-subtitle home-subtitle">
                Verified PGs, rooms and flats across India. Talk directly to owners with
                zero brokerage and total transparency.
              </p>

              <div className="hero-search">
                <Search size={20} color="#69768f" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by area, colony or city..."
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSearch();
                    }
                  }}
                />
                <button className="btn btn-dark" onClick={handleSearch}>
                  Search
                </button>
              </div>

              <div className="popular-row">
                <span className="home-popular-label">Popular:</span>
                {popularAreas.map((area) => (
                  <button
                    key={area}
                    className="pill-chip small"
                    onClick={() => navigate(`/browse?search=${encodeURIComponent(area)}`)}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="page-section home-section-padded">
          <div className="page-container">
            <div className="feature-grid">
              <article className="feature-card">
                <div className="feature-icon">
                  <Shield size={20} />
                </div>
                <h3>Verified Listings</h3>
                <p>Every property is verified by our team before going live.</p>
              </article>
              <article className="feature-card">
                <div className="feature-icon">
                  <Zap size={20} />
                </div>
                <h3>Zero Brokerage</h3>
                <p>Connect directly with owners. No middlemen and no extra fees.</p>
              </article>
              <article className="feature-card">
                <div className="feature-icon">
                  <Heart size={20} />
                </div>
                <h3>Made for Renters</h3>
                <p>Smart filters and honest listing details help you decide faster.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="page-section">
          <div className="page-container">
            <div className="section-head">
              <div>
                <h2>Featured rentals</h2>
                <p>Hand-picked verified homes near you</p>
              </div>
              <Link to="/browse" className="link-accent home-view-all-link">
                View all <ArrowRight size={16} className="home-view-all-icon" />
              </Link>
            </div>

            <div className="listing-grid">
              {loading
                ? Array.from({ length: 3 }).map((_, index) => (
                    <div key={`home-skeleton-${index}`} className="listing-card">
                      <Skeleton className="home-featured-skeleton" />
                      <div className="home-skeleton-content">
                        <Skeleton className="home-skeleton-title" />
                        <Skeleton className="home-skeleton-subtitle" />
                        <Skeleton className="home-skeleton-meta" />
                      </div>
                    </div>
                  ))
                : featured.map((item) => (
                    <ListingCard
                      key={item.listingId}
                      listingId={item.listingId}
                      title={item.title}
                      colony={item.colony}
                      city={item.city}
                      monthlyRent={item.monthlyRent}
                      rentTiers={item.rentTiers ?? []}
                      maxOccupants={item.maxOccupants}
                      roomCategoryName={item.roomCategoryName}
                      landlordGender={item.landlordGender}
                      roomFor={item.roomFor}
                      propertyTypeId={item.propertyTypeId}
                      furnishingName={item.furnishingName}
                      foodPreferenceName={item.foodPreferenceName ?? ""}
                      coverPhotoUrl={item.coverPhotoUrl}
                      createdAt={item.createdAt}
                    />
                  ))}
            </div>

            <div className="cta-banner">
              <div>
                <span className="badge badge-dark home-cta-badge">
                  <MapPin size={14} />
                  For Owners
                </span>
                <h2 className="home-cta-title">
                  List your property in 3 minutes
                </h2>
                <p>Reach thousands of verified tenants. No commission, no hassle.</p>
              </div>

              <div className="home-cta-actions">
                <Link to="/post-property" className="btn btn-primary">
                  Post Property Free
                  <ArrowRight size={18} />
                </Link>
                <Link to="/browse" className="btn btn-outline home-cta-secondary">
                  See how it works
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

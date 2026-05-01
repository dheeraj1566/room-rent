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

type Listing = {
  listingId: string;
  title: string;
  colony: string;
  city: string;
  monthlyRent: number;
  rentTiers: { occupants: number; rent: number }[];
  maxOccupants: number;
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

  return (
    <div className="app-shell">
      <main className="page-shell">
        <section className="hero-panel dot-grid hero-gradient">
          <div className="page-container home-hero">
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
                <img src={brandLogo} alt="Roombaazi" style={{ height: 48, width: "auto" }} />
                <div style={{ display: "flex", gap: 10 }}>
                  <Link to="/login" className="btn btn-outline" style={{ padding: "8px 20px", fontSize: 14 }}>
                    Login
                  </Link>
                  <Link to="/register" className="btn btn-dark" style={{ padding: "8px 20px", fontSize: 14 }}>
                    Register
                  </Link>
                </div>
              </div>
              <span className="badge badge-soft">
                <Star size={14} fill="currentColor" />
                Trusted by 50,000+ renters
              </span>
              <h1 className="section-title" style={{ marginTop: 20 }}>
                Find your next home,
                <br />
                <span className="accent">without the broker</span>
              </h1>
              <p className="section-subtitle" style={{ maxWidth: 760, margin: "18px auto 0" }}>
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
                <span style={{ fontWeight: 700, color: "var(--slate-700)" }}>Popular:</span>
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

        <section className="page-section" style={{ paddingTop: "4rem" }}>
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
              <Link to="/browse" className="link-accent" style={{ textDecoration: "none" }}>
                View all <ArrowRight size={16} style={{ verticalAlign: "middle" }} />
              </Link>
            </div>

            <div className="listing-grid">
              {loading
                ? Array.from({ length: 3 }).map((_, index) => (
                    <div key={`home-skeleton-${index}`} className="listing-card">
                      <Skeleton style={{ aspectRatio: "1.24 / 1" }} />
                      <div style={{ padding: 18 }}>
                        <Skeleton style={{ height: 22, width: "48%", marginBottom: 10 }} />
                        <Skeleton style={{ height: 18, width: "75%", marginBottom: 8 }} />
                        <Skeleton style={{ height: 18, width: "55%" }} />
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
                <span className="badge badge-dark" style={{ marginBottom: 14 }}>
                  <MapPin size={14} />
                  For Owners
                </span>
                <h2 style={{ fontSize: "2rem", marginBottom: 8 }}>
                  List your property in 3 minutes
                </h2>
                <p>Reach thousands of verified tenants. No commission, no hassle.</p>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Link to="/post-property" className="btn btn-primary">
                  Post Property Free
                  <ArrowRight size={18} />
                </Link>
                <Link to="/browse" className="btn btn-outline" style={{ color: "white", borderColor: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)" }}>
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

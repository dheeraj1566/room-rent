import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { User, ArrowRightToLine, Plus, Heart } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import brandLogo from "../../assets/Roombaazi Final Logo.png";

const routeAliases: Record<string, string[]> = {
  browse: ["/browse", "/listings", "/listings/"],
  properties: ["/my-properties", "/dashboard"],
  post: ["/post-property", "/add-listing"],
  liked: ["/liked-properties"],
  profile: ["/profile"],
};

const matchAlias = (pathname: string, aliases: string[]) =>
  aliases.some((alias) => pathname === alias || pathname.startsWith(alias));

export default function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isCompact, setIsCompact] = useState(false);
  const isAuthenticated = Boolean(user);
  const profileCompletionFields = [
    Boolean(user?.hasFullName),
    Boolean(user?.hasEmail),
    Boolean(user?.hasPhone),
    Boolean(user?.hasGender),
    Boolean(user?.hasPhoto),
    Boolean(user?.hasAadhaar),
  ];
  const completedProfileFields = profileCompletionFields.filter(Boolean).length;
  const profileCompletionPercent = Math.round((completedProfileFields / profileCompletionFields.length) * 100);

  useEffect(() => {
    let rafId = 0;
    let lastCompact = false;

    const update = () => {
      rafId = 0;
      const y = window.scrollY || 0;

      // Hysteresis avoids flicker/jitter around the threshold.
      const nextCompact = lastCompact ? y > 8 : y > 24;
      if (nextCompact !== lastCompact) {
        lastCompact = nextCompact;
        setIsCompact(nextCompact);
      }
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <header className={`app-navbar ${isCompact ? "is-compact" : ""}`}>
      <div className="app-navbar-inner">
        <Link to={isAuthenticated ? "/browse" : "/"} className="brand-link">
          <img className="brand-logo" src={brandLogo} alt="Roombaazi" />
        </Link>

        <nav className="nav-center" aria-label="Primary">
          <Link
            to={isAuthenticated ? "/browse" : "/"}
            className={`nav-link ${matchAlias(location.pathname, routeAliases.browse) ? "active" : ""}`}
          >
            Browse
          </Link>
          <Link
            to={isAuthenticated ? "/my-properties" : "/login"}
            className={`nav-link ${matchAlias(location.pathname, routeAliases.properties) ? "active" : ""}`}
          >
            My Properties
          </Link>
        </nav>

        <div className="nav-actions">
          {isAuthenticated ? (
            <>
              <Link to="/post-property" className="btn btn-primary btn-sm">
                <Plus size={18} />
                Post Property
                <span className="btn-free-tag">FREE</span>
              </Link>
              <Link
                to="/liked-properties"
                className={`icon-pill ${matchAlias(location.pathname, routeAliases.liked) ? "active" : ""}`}
                aria-label="Liked properties"
              >
                <Heart size={20} />
              </Link>
              <Link
                to="/profile"
                className={`nav-link nav-link-profile ${matchAlias(location.pathname, routeAliases.profile) ? "active" : ""}`}
              >
                <User size={18} />
                Profile
                <span className="nav-progress-badge">{profileCompletionPercent}%</span>
              </Link>
              <button className="icon-pill" onClick={() => void logout()} aria-label="Logout">
                <ArrowRightToLine size={20} />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">
                Log In
              </Link>
              <Link to="/signup" className="btn btn-primary btn-sm">
                Create Account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

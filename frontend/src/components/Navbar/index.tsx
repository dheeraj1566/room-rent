import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { User, ArrowRightToLine, Plus, Heart, Menu, X } from "lucide-react";
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
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

  // Close mobile menu on escape key or resize
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        closeMobileMenu();
      }
    };

    const handleResize = () => {
      if (window.innerWidth > 980 && isMobileMenuOpen) {
        closeMobileMenu();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobileMenuOpen]);

  // Body scroll lock when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const closeMobileMenu = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsMobileMenuOpen(false);
      setIsClosing(false);
    }, 300); // Match the animation duration
  };

  const handleMobileMenuToggle = () => {
    if (isMobileMenuOpen) {
      closeMobileMenu();
    } else {
      setIsMobileMenuOpen(true);
    }
  };

  const handleMenuItemClick = () => {
    closeMobileMenu();
  };

  return (
    <>
      <header className={`app-navbar ${isCompact ? "is-compact" : ""}`}>
        <div className="app-navbar-inner">
          <Link to={isAuthenticated ? "/browse" : "/"} className="brand-link">
            <img className="brand-logo" src={brandLogo} alt="Roombaazi" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="nav-center nav-desktop" aria-label="Primary">
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

          {/* Desktop Actions */}
          <div className="nav-actions nav-desktop">
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

          {/* Mobile Menu Button */}
          <button 
            className="mobile-menu-btn"
            onClick={handleMobileMenuToggle}
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className={`mobile-menu-overlay ${isClosing ? 'closing' : ''}`} onClick={closeMobileMenu}>
          <nav className={`mobile-menu ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-content">
              <Link
                to={isAuthenticated ? "/browse" : "/"}
                className={`mobile-nav-link ${matchAlias(location.pathname, routeAliases.browse) ? "active" : ""}`}
                onClick={handleMenuItemClick}
              >
                Browse
              </Link>
              <Link
                to={isAuthenticated ? "/my-properties" : "/login"}
                className={`mobile-nav-link ${matchAlias(location.pathname, routeAliases.properties) ? "active" : ""}`}
                onClick={handleMenuItemClick}
              >
                My Properties
              </Link>
              
              {isAuthenticated ? (
                <>
                  <Link 
                    to="/post-property" 
                    className="mobile-nav-link"
                    onClick={handleMenuItemClick}
                  >
                    <Plus size={20} />
                    Post Property
                    <span className="mobile-free-tag">FREE</span>
                  </Link>
                  <Link
                    to="/liked-properties"
                    className={`mobile-nav-link ${matchAlias(location.pathname, routeAliases.liked) ? "active" : ""}`}
                    onClick={handleMenuItemClick}
                  >
                    <Heart size={20} />
                    Liked Properties
                  </Link>
                  <Link
                    to="/profile"
                    className={`mobile-nav-link ${matchAlias(location.pathname, routeAliases.profile) ? "active" : ""}`}
                    onClick={handleMenuItemClick}
                  >
                    <User size={20} />
                    Profile
                    <span className="mobile-progress-badge">{profileCompletionPercent}%</span>
                  </Link>
                  <button 
                    className="mobile-nav-link mobile-logout-btn" 
                    onClick={() => {
                      void logout();
                      handleMenuItemClick();
                    }}
                  >
                    <ArrowRightToLine size={20} />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link 
                    to="/login" 
                    className="mobile-nav-link"
                    onClick={handleMenuItemClick}
                  >
                    Log In
                  </Link>
                  <Link 
                    to="/signup" 
                    className="mobile-nav-link mobile-nav-cta"
                    onClick={handleMenuItemClick}
                  >
                    Create Account
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

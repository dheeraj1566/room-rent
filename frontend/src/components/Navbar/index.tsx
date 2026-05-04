import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { User, ArrowRightToLine, Plus, Heart, Menu, X, Inbox, Bell } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import brandLogo from "../../assets/Roombaazi Final Logo.png";
import {
  getTenantRequestNotifications,
  subscribeToNotificationUpdates,
  type TenantRequestNotification,
} from "../../lib/notifications";

const routeAliases: Record<string, string[]> = {
  browse: ["/browse", "/listings", "/listings/"],
  properties: ["/my-properties", "/dashboard"],
  contacted: ["/contacted-properties"],
  post: ["/post-property", "/add-listing"],
  liked: ["/liked-properties"],
  profile: ["/profile"],
};

const matchAlias = (pathname: string, aliases: string[]) =>
  aliases.some((alias) => pathname === alias || pathname.startsWith(alias));

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isCompact, setIsCompact] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const [notifications, setNotifications] = useState<TenantRequestNotification[]>([]);
  const isAuthenticated = Boolean(user);
  const unreadCount = notifications.length;
  const profileCompletionFields = [
    Boolean(user?.hasFullName),
    Boolean(user?.hasEmail),
    Boolean(user?.hasPhone),
    Boolean(user?.hasGender),
    Boolean(user?.hasPhoto),
    Boolean(user?.hasAadhaar),
    Boolean(user?.isVerified),
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

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!notificationsRef.current) return;
      if (!notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  useEffect(() => {
    setIsNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const syncFromStorage = () => {
      setNotifications(getTenantRequestNotifications());
    };

    syncFromStorage();
    const unsubscribe = subscribeToNotificationUpdates(syncFromStorage);
    return unsubscribe;
  }, []);

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

  const handleNotificationClick = (connectionId: string) => {
    setIsNotificationsOpen(false);
    navigate(`/dashboard?request=${connectionId}`);
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
            <Link
              to={isAuthenticated ? "/contacted-properties" : "/login"}
              className={`nav-link ${matchAlias(location.pathname, routeAliases.contacted) ? "active" : ""}`}
            >
              Contacted
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
                <div className="nav-notifications" ref={notificationsRef}>
                  <button
                    type="button"
                    className={`icon-pill notification-trigger ${isNotificationsOpen ? "active" : ""}`}
                    aria-label="Notifications"
                    aria-expanded={isNotificationsOpen}
                    onClick={() => setIsNotificationsOpen((prev) => !prev)}
                  >
                    <Bell size={20} />
                    {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                  </button>
                  {isNotificationsOpen && (
                    <div className="notification-dropdown" role="menu" aria-label="Notifications">
                      <div className="notification-header">
                        <h4>Notifications</h4>
                      </div>
                      <div className="notification-list">
                        {notifications.length === 0 ? (
                          <div className="notification-empty">
                            <p>No new notifications</p>
                          </div>
                        ) : (
                          notifications.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className="notification-item unread"
                              role="menuitem"
                              onClick={() => handleNotificationClick(item.connectionId)}
                            >
                              <p className="notification-title">Request from tenant</p>
                              <p className="notification-message">
                                {item.tenantName} requested to contact your {item.listingTitle}.
                              </p>
                              <span className="notification-time">
                                {new Date(item.requestedAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                })}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
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

          <div className="mobile-actions">
            {isAuthenticated ? (
              <div className="nav-notifications mobile-notifications" ref={notificationsRef}>
                <button
                  type="button"
                  className={`icon-pill notification-trigger ${isNotificationsOpen ? "active" : ""}`}
                  aria-label="Notifications"
                  aria-expanded={isNotificationsOpen}
                  onClick={() => setIsNotificationsOpen((prev) => !prev)}
                >
                  <Bell size={20} />
                  {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                </button>
                {isNotificationsOpen && (
                  <div className="notification-dropdown" role="menu" aria-label="Notifications">
                    <div className="notification-header">
                      <h4>Notifications</h4>
                    </div>
                    <div className="notification-list">
                      {notifications.length === 0 ? (
                        <div className="notification-empty">
                          <p>No new notifications</p>
                        </div>
                      ) : (
                        notifications.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="notification-item unread"
                            role="menuitem"
                            onClick={() => handleNotificationClick(item.connectionId)}
                          >
                            <p className="notification-title">Request from tenant</p>
                            <p className="notification-message">
                              {item.tenantName} requested to contact your {item.listingTitle}.
                            </p>
                            <span className="notification-time">
                              {new Date(item.requestedAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Mobile Menu Button */}
            <button
              className="mobile-menu-btn"
              onClick={handleMobileMenuToggle}
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
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
                    to="/contacted-properties"
                    className={`mobile-nav-link ${matchAlias(location.pathname, routeAliases.contacted) ? "active" : ""}`}
                    onClick={handleMenuItemClick}
                  >
                    <Inbox size={20} />
                    Contacted Properties
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

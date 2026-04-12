import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Search, User, LogOut } from 'lucide-react';
import brandLogo from '../assets/Roombaazi Final Logo.png';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState('');

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    if (location.pathname !== '/listings') return;
    setSearchValue(searchParams.get('search') || '');
  }, [location.pathname, searchParams]);

  useEffect(() => {
    if (location.pathname !== '/listings') return;
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (navigation?.type !== 'reload') return;

    const next = new URLSearchParams(searchParams);
    next.delete('search');
    next.set('page', '1');
    setSearchValue('');
    setSearchParams(next);
  }, [location.pathname, searchParams, setSearchParams]);

  const applySearch = () => {
    const next = new URLSearchParams(searchParams);
    const trimmed = searchValue.trim();
    if (trimmed) {
      next.set('search', trimmed);
    } else {
      next.delete('search');
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to={user ? '/listings' : '/'} className="navbar-brand">
          <img
            src={brandLogo}
            alt="Roombaazi"
            className="navbar-brand-logo"
          />
        </Link>

        {user && location.pathname === '/listings' && (
          <div className="navbar-search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search properties, locations..."
              aria-label="Search properties"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applySearch();
                }
              }}
              onBlur={applySearch}
            />
          </div>
        )}

        <div className="navbar-links">
          {user ? (
            <>
              <Link to="/listings" className={`nav-link ${isActive('/listings') ? 'active' : ''}`}>
                Browse
              </Link>
              <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
                My Properties
              </Link>
              <Link to="/add-listing" className="btn btn-primary btn-sm">
                + Post Property
              </Link>
              <Link to="/profile" className={`nav-link ${isActive('/profile') ? 'active' : ''}`}>
                <User size={18} />
                Profile
              </Link>
              <button className="btn btn-outline btn-sm" onClick={logout}>
                <LogOut size={16} />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}


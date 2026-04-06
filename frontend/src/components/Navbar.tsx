import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Search, User, LogOut } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to={user ? "/listings" : "/"} className="navbar-brand">
          <h1 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 700 }}>
            Rent<span style={{ color: 'var(--brand-primary)' }}>Hub</span>
          </h1>
        </Link>

        {user && location.pathname === '/listings' && (
          <div className="navbar-search">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Search properties, locations..."
              aria-label="Search properties"
            />
          </div>
        )}

        <div className="navbar-links">
          {user ? (
            <>
              <Link 
                to="/listings" 
                className={`nav-link ${isActive('/listings') ? 'active' : ''}`}
              >
                Browse
              </Link>
              <Link 
                to="/add-listing" 
                className="btn btn-primary btn-sm"
              >
                + Post Property
              </Link>
              <Link 
                to="/profile" 
                className={`nav-link ${isActive('/profile') ? 'active' : ''}`}
              >
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

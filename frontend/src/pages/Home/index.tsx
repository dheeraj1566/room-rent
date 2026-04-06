import { Link } from 'react-router-dom';
import { Search, Home as HomeIcon, Shield, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)' }}>
      {/* Hero Section */}
      <section style={{ 
        background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%)',
        color: 'white',
        padding: '4rem 1.5rem',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <h1 style={{ 
            fontSize: 'clamp(2rem, 5vw, 3.5rem)', 
            fontWeight: 700, 
            marginBottom: '1rem',
            color: 'white'
          }}>
            Find Your Perfect Rental Home
          </h1>
          <p style={{ 
            fontSize: 'clamp(1rem, 2vw, 1.25rem)', 
            marginBottom: '2.5rem',
            color: 'rgba(255, 255, 255, 0.9)',
            maxWidth: '600px',
            margin: '0 auto 2.5rem'
          }}>
            Discover thousands of verified rental properties. Simple, safe, and hassle-free.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {user ? (
              <>
                <Link to="/listings" style={{ textDecoration: 'none' }}>
                  <button className="btn" style={{ 
                    background: 'white', 
                    color: 'var(--brand-primary)',
                    padding: '0.875rem 2rem',
                    fontSize: '1.0625rem',
                    fontWeight: 600
                  }}>
                    <Search size={20} />
                    Browse Properties
                  </button>
                </Link>
                <Link to="/add-listing" style={{ textDecoration: 'none' }}>
                  <button className="btn" style={{ 
                    background: 'transparent', 
                    color: 'white',
                    border: '2px solid white',
                    padding: '0.875rem 2rem',
                    fontSize: '1.0625rem',
                    fontWeight: 600
                  }}>
                    Post Your Property
                  </button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/register" style={{ textDecoration: 'none' }}>
                  <button className="btn" style={{ 
                    background: 'white', 
                    color: 'var(--brand-primary)',
                    padding: '0.875rem 2rem',
                    fontSize: '1.0625rem',
                    fontWeight: 600
                  }}>
                    Get Started
                  </button>
                </Link>
                <Link to="/login" style={{ textDecoration: 'none' }}>
                  <button className="btn" style={{ 
                    background: 'transparent', 
                    color: 'white',
                    border: '2px solid white',
                    padding: '0.875rem 2rem',
                    fontSize: '1.0625rem',
                    fontWeight: 600
                  }}>
                    Sign In
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={{ padding: '4rem 1.5rem', background: 'var(--bg-card)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <h2 style={{ 
            textAlign: 'center', 
            fontSize: '2rem', 
            marginBottom: '3rem',
            color: 'var(--text-main)'
          }}>
            Why Choose RentHub?
          </h2>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: '2rem' 
          }}>
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ 
                width: '80px', 
                height: '80px', 
                background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.15) 0%, rgba(255, 167, 38, 0.15) 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
                color: 'var(--brand-primary)'
              }}>
                <Search size={36} />
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Easy Search</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Find your ideal property with powerful filters and smart search
              </p>
            </div>

            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ 
                width: '80px', 
                height: '80px', 
                background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.15) 0%, rgba(255, 167, 38, 0.15) 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
                color: 'var(--brand-primary)'
              }}>
                <Shield size={36} />
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Verified Listings</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                All properties are verified for authenticity and accuracy
              </p>
            </div>

            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ 
                width: '80px', 
                height: '80px', 
                background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.15) 0%, rgba(255, 167, 38, 0.15) 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
                color: 'var(--brand-primary)'
              }}>
                <Clock size={36} />
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Quick Process</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Connect with owners instantly and move in faster
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ 
        padding: '4rem 1.5rem',
        background: 'var(--bg-color)',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <HomeIcon size={48} style={{ color: 'var(--brand-primary)', marginBottom: '1.5rem' }} />
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            Ready to Find Your Home?
          </h2>
          <p style={{ 
            fontSize: '1.125rem', 
            color: 'var(--text-muted)', 
            marginBottom: '2rem',
            lineHeight: '1.6'
          }}>
            Join thousands of happy tenants and landlords on RentHub
          </p>
          <Link to={user ? "/listings" : "/register"} style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary" style={{ 
              padding: '0.875rem 2.5rem',
              fontSize: '1.0625rem'
            }}>
              {user ? "Browse Properties" : "Get Started Free"}
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ 
        background: 'var(--brand-primary)',
        color: 'white',
        padding: '2rem 1.5rem',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <p style={{ margin: 0, opacity: 0.9 }}>
            © 2026 RentHub. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

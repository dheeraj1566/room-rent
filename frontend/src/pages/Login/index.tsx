import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const data = await apiFetch<{ user: { id: string; email: string; role: string } }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      setUser(data.user);
      navigate("/listings");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'var(--bg-color)' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--brand-primary)' }}>RentHub</h1>
          <p style={{ color: 'var(--text-muted)' }}>Find your perfect rental home</p>
        </div>

        <div className="glass-card">
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Welcome Back</h2>
          
          {errorMsg && (
            <div style={{ padding: '0.75rem', background: '#fee', border: '1px solid #fcc', borderRadius: '4px', marginBottom: '1rem' }}>
              <p style={{ color: '#c33', margin: 0, fontSize: '0.875rem' }}>{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                className="input-style" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required 
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                className="input-style" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required 
              />
            </div>

            <button type="submit" className="btn btn-primary w-full" style={{ marginTop: '1.5rem' }} disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <p style={{ margin: 0, fontSize: '0.9375rem' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: 'var(--brand-secondary)', fontWeight: 600, textDecoration: 'none' }}>
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

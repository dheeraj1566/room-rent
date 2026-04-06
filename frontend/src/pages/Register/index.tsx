import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'Tenant' | 'Landlord'>('Tenant');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
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
      const data = await apiFetch<{ user: { id: string; email: string; role: string } }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          fullName: fullName.trim(),
          role,
          email: email.trim(),
          phone: phone.trim(),
          password,
        }),
      });

      setUser(data.user);
      navigate("/listings");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
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
          <p style={{ color: 'var(--text-muted)' }}>Start your rental journey today</p>
        </div>

        <div className="glass-card">
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Create Account</h2>
          
          {errorMsg && (
            <div style={{ padding: '0.75rem', background: '#fee', border: '1px solid #fcc', borderRadius: '4px', marginBottom: '1rem' }}>
              <p style={{ color: '#c33', margin: 0, fontSize: '0.875rem' }}>{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full Name</label>
              <input 
                type="text" 
                className="input-style" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                required 
              />
            </div>

            <div className="form-group">
              <label>I am signing up as</label>
              <select
                className="input-style"
                value={role}
                onChange={(e) => setRole(e.target.value as 'Tenant' | 'Landlord')}
              >
                <option value="Tenant">Tenant</option>
                <option value="Landlord">Landlord</option>
              </select>
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input 
                type="tel" 
                className="input-style" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                required 
              />
            </div>

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
                placeholder="Create a strong password"
                required 
              />
            </div>

            <button type="submit" className="btn btn-primary w-full" style={{ marginTop: '1.5rem' }} disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <p style={{ margin: 0, fontSize: '0.9375rem' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--brand-secondary)', fontWeight: 600, textDecoration: 'none' }}>
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import brandLogo from '../../assets/Roombaazi Final Logo.png';

export default function Login() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const isGoogleConfigured = Boolean(googleClientId && googleClientId.trim());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    if (!isGoogleConfigured || !googleButtonRef.current) {
      return;
    }
    const configuredGoogleClientId = googleClientId as string;

    let cancelled = false;

    const renderGoogleButton = () => {
      if (cancelled || !googleButtonRef.current || !window.google) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: configuredGoogleClientId,
        callback: async ({ credential }) => {
          if (!credential) {
            setErrorMsg('Google login failed. Try again.');
            return;
          }

          setGoogleLoading(true);
          setErrorMsg('');

          try {
            const data = await apiFetch<{ user: { id: string; email: string; role: string } }>('/api/auth/google', {
              method: 'POST',
              body: JSON.stringify({ idToken: credential }),
            });

            setUser(data.user);
            navigate('/listings');
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Google login failed';
            setErrorMsg(message);
          } finally {
            setGoogleLoading(false);
          }
        },
      });

      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 360,
        text: 'continue_with',
      });
      setGoogleReady(true);
    };

    if (window.google) {
      renderGoogleButton();
      return () => {
        cancelled = true;
      };
    }

    const existingScript = document.getElementById('google-gsi-script') as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    script.onerror = () => {
      if (!cancelled) setErrorMsg('Unable to load Google Sign-In. Try again later.');
    };
    if (!existingScript) {
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [isGoogleConfigured, googleClientId, navigate, setUser]);

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
      navigate('/listings');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'var(--bg-color)' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src={brandLogo} alt="Roombaazi" style={{ width: '210px', maxWidth: '100%', margin: '0 auto 0.75rem', display: 'block' }} />
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
              <div style={{ marginTop: '0.5rem', textAlign: 'right' }}>
                <Link to="/forgot-password" style={{ color: 'var(--brand-secondary)', fontWeight: 600, textDecoration: 'none', fontSize: '0.875rem' }}>
                  Forgot password?
                </Link>
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full" style={{ marginTop: '1.5rem' }} disabled={loading || googleLoading}>
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>

          <div style={{ marginTop: '1rem', marginBottom: '0.25rem' }}>
            <div style={{ position: 'relative', textAlign: 'center', margin: '1rem 0' }}>
              <span style={{ background: 'var(--bg-card)', padding: '0 0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', position: 'relative', zIndex: 1 }}>
                or
              </span>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'var(--border-color)', zIndex: 0 }} />
            </div>

            {isGoogleConfigured ? (
              <div style={{ display: 'flex', justifyContent: 'center', minHeight: '44px', opacity: googleLoading ? 0.7 : 1 }}>
                <div ref={googleButtonRef} />
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  disabled
                  aria-label="Continue with Google"
                  style={{
                    width: '100%',
                    maxWidth: '360px',
                    height: '44px',
                    borderRadius: '9999px',
                    border: '1px solid var(--border-color)',
                    background: '#fff',
                    color: '#1f1f1f',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    cursor: 'not-allowed',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.25h2.92c1.71-1.57 2.68-3.88 2.68-6.6z"
                    />
                    <path
                      fill="#34A853"
                      d="M9 18c2.43 0 4.47-.8 5.96-2.2l-2.92-2.25c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.11-1.18.29-1.71V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.03l3.01-2.32z"
                    />
                    <path
                      fill="#EA4335"
                      d="M9 3.58c1.32 0 2.5.45 3.43 1.35l2.57-2.57C13.46.94 11.42 0 9 0A9 9 0 0 0 .96 4.97l3.01 2.32c.71-2.12 2.69-3.71 5.03-3.71z"
                    />
                  </svg>
                  Continue with Google
                </button>
              </div>
            )}

            {isGoogleConfigured && !googleReady && (
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.875rem', textAlign: 'center' }}>
                Loading Google Sign-In...
              </p>
            )}
            {!isGoogleConfigured && (
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.875rem', textAlign: 'center' }}>
                Add <code>VITE_GOOGLE_CLIENT_ID</code> in <code>frontend/.env</code> to enable this button.
              </p>
            )}
          </div>

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

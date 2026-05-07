import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import "./Login.css";
import brandLogo from "../../assets/Roombaazi Final Logo.png";
import SiteFooter from "../../components/SiteFooter";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";
import { isValidEmail } from "../../lib/validation";

export default function Login() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const isGoogleConfigured = Boolean(googleClientId?.trim());
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const { refreshSession } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!isGoogleConfigured || !googleButtonRef.current) return;
    const clientId = googleClientId as string;
    let cancelled = false;

    const renderButton = () => {
      if (cancelled || !window.google || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          if (!credential) return;
          setGoogleLoading(true);
          try {
            await apiFetch("/api/auth/google", {
              method: "POST",
              body: JSON.stringify({ idToken: credential }),
            });
            await refreshSession();
            navigate("/browse");
          } catch (error) {
            setErrorMsg(error instanceof Error ? error.message : "Google login failed");
          } finally {
            setGoogleLoading(false);
          }
        },
      });
      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        width: 360,
        text: "continue_with",
      });
    };

    if (window.google) {
      renderButton();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderButton;
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [googleClientId, isGoogleConfigured, navigate, refreshSession]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setErrorMsg("Enter a valid email address with a proper domain like gmail.com");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      await refreshSession();
      navigate("/browse");
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell auth-shell">
      <main className="auth-main">
        <div className="page-container">
          <div className="auth-logo-wrap">
            <img src={brandLogo} alt="Roombaazi" />
          </div>

          <div className="surface-card auth-card compact">
            <h1 className="login-title-hero">Welcome Back</h1>
            <p className="login-subtitle-hero">Log in to continue your search</p>

            {errorMsg ? <div className="error-banner">{errorMsg}</div> : null}

            <form onSubmit={handleSubmit}>
              <div className="field login-field-spacing">
                <label>Email Address</label>
                <input
                  className="input-style"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="field">
                <label>Password</label>
                <div className="password-input-wrapper">
                  <input
                    className="input-style password-input"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="login-forgot-link-row">
                  <Link to="/forgot-password" className="link-accent login-forgot-link">
                    Forgot password?
                  </Link>
                </div>
              </div>

              <button className="btn btn-dark btn-block login-submit-btn" disabled={loading || googleLoading}>
                {loading ? "Logging in..." : "Log In"}
              </button>
            </form>

            <div className="auth-divider">
              <span>or</span>
            </div>

            {isGoogleConfigured ? (
              <div className="login-google-wrapper">
                <div ref={googleButtonRef} />
              </div>
            ) : (
              <button className="btn btn-outline btn-block" disabled>
                Continue with Google
              </button>
            )}

            <div className="auth-link-row login-register-row">
              Don't have an account? <Link to="/signup">Sign up</Link>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

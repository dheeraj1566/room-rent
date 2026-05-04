import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Info } from "lucide-react";
import { apiFetch } from "../../lib/api";
import brandLogo from "../../assets/Roombaazi Final Logo.png";

const OTP_RESEND_LIMIT = 3;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [resendCount, setResendCount] = useState(0);
  const [isLimitHit, setIsLimitHit] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setErrorMsg("");

    try {
      const response = await apiFetch<{ message: string; resetToken?: string; email?: string; otpCode?: string }>(
        "/api/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({ email: email.trim() }),
        }
      );
      const newCount = resendCount + 1;
      setResendCount(newCount);
      setMessage(response.message);
      if (response.resetToken && response.email) {
        const otpQuery = response.otpCode ? `&otp=${encodeURIComponent(response.otpCode)}` : "";
        navigate(
          `/reset-password?token=${encodeURIComponent(response.resetToken)}&email=${encodeURIComponent(
            response.email
          )}${otpQuery}`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send reset email";
      setErrorMsg(msg);
      // 429 = limit exhausted
      if (msg.toLowerCase().includes("maximum") || msg.toLowerCase().includes("limit")) {
        setIsLimitHit(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const remaining = OTP_RESEND_LIMIT - resendCount;

  return (
    <div className="auth-shell">
      <div className="auth-container">
        <div className="auth-header">
          <img
            src={brandLogo}
            alt="Roombaazi"
            className="auth-logo"
          />
          <p className="auth-subtitle">Password reset instructions will be sent to your email.</p>
        </div>

        <div className="glass-card">
          <h2 className="text-center mb-5">Forgot Password</h2>

          {/* Static info banner — always visible */}
          <div className="alert-info">
            <Info size={16} className="alert-icon" />
            <p className="alert-content">
              You can request an OTP up to <strong>{OTP_RESEND_LIMIT} times</strong> per 24 hours.
              {resendCount > 0 && (
                <span>
                  {" "}
                  <strong style={{ color: remaining <= 1 ? "#dc2626" : "#92400e" }}>
                    {remaining} attempt{remaining !== 1 ? "s" : ""} remaining.
                  </strong>
                </span>
              )}
            </p>
          </div>

          {message && (
            <div className="alert-success">
              <p className="alert-content">{message}</p>
            </div>
          )}

          {/* Error / limit-hit banner */}
          {errorMsg && (
            <div className={`alert-error ${!isLimitHit ? 'severe' : ''}`}>
              <AlertTriangle size={16} className="alert-icon" />
              <p className="alert-content">{errorMsg}</p>
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
                disabled={isLimitHit}
              />
            </div>
            <button className="btn btn-primary w-full" type="submit" disabled={loading || isLimitHit}>
              {loading ? "Sending..." : resendCount > 0 ? `Resend OTP (${remaining} left)` : "Send Reset Email"}
            </button>
          </form>

          <div className="auth-links">
            <Link to="/reset-password" className="auth-link">
              Already have OTP? Reset now
            </Link>
          </div>
          <div className="auth-links">
            <Link to="/login" className="auth-link muted">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

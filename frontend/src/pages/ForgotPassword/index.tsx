import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import brandLogo from "../../assets/Roombaazi Final Logo.png";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

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
      setErrorMsg(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        background: "var(--bg-color)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "440px" }}>
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <img
            src={brandLogo}
            alt="Roombaazi"
            style={{ width: "210px", maxWidth: "100%", margin: "0 auto 0.75rem", display: "block" }}
          />
          <p style={{ color: "var(--text-muted)" }}>Password reset instructions will be sent to your email.</p>
        </div>

        <div className="glass-card">
          <h2 style={{ marginBottom: "1.25rem", textAlign: "center" }}>Forgot Password</h2>
          {message && (
            <div
              style={{
                padding: "0.75rem",
                background: "#eef9f1",
                border: "1px solid #b7e4c7",
                borderRadius: "8px",
                marginBottom: "1rem",
              }}
            >
              <p style={{ color: "#146c43", margin: 0, fontSize: "0.9rem" }}>{message}</p>
            </div>
          )}
          {errorMsg && (
            <div
              style={{
                padding: "0.75rem",
                background: "#fee",
                border: "1px solid #fcc",
                borderRadius: "8px",
                marginBottom: "1rem",
              }}
            >
              <p style={{ color: "#c33", margin: 0, fontSize: "0.9rem" }}>{errorMsg}</p>
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
            <button className="btn btn-primary w-full" type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Email"}
            </button>
          </form>

          <div style={{ marginTop: "1.25rem", textAlign: "center" }}>
            <Link to="/reset-password" style={{ color: "var(--brand-secondary)", fontWeight: 600, textDecoration: "none" }}>
              Already have OTP? Reset now
            </Link>
          </div>
          <div style={{ marginTop: "0.75rem", textAlign: "center" }}>
            <Link to="/login" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

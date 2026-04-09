import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import brandLogo from "../../assets/Roombaazi Final Logo.png";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromLink = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const emailFromLink = useMemo(() => searchParams.get("email") || "", [searchParams]);
  const otpFromLink = useMemo(() => searchParams.get("otp") || "", [searchParams]);

  const [email, setEmail] = useState(emailFromLink);
  const [otpCode, setOtpCode] = useState(otpFromLink.replace(/\D/g, "").slice(0, 6));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (!tokenFromLink && !otpCode.trim()) {
      setErrorMsg("Enter OTP code or open this page from reset email link.");
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, string> = {
        email: email.trim(),
        newPassword,
      };
      if (tokenFromLink) payload.token = tokenFromLink;
      if (otpCode.trim()) payload.otpCode = otpCode.trim();

      const response = await apiFetch<{ message: string }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccessMsg(response.message);
      setTimeout(() => navigate("/login"), 1500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to reset password");
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
      <div style={{ width: "100%", maxWidth: "460px" }}>
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <img
            src={brandLogo}
            alt="Roombaazi"
            style={{ width: "210px", maxWidth: "100%", margin: "0 auto 0.75rem", display: "block" }}
          />
          <p style={{ color: "var(--text-muted)" }}>
            {tokenFromLink ? "Reset token detected from your email link." : "Enter OTP from email to reset password."}
          </p>
        </div>

        <div className="glass-card">
          <h2 style={{ marginBottom: "1.25rem", textAlign: "center" }}>Reset Password</h2>

          {successMsg && (
            <div
              style={{
                padding: "0.75rem",
                background: "#eef9f1",
                border: "1px solid #b7e4c7",
                borderRadius: "8px",
                marginBottom: "1rem",
              }}
            >
              <p style={{ color: "#146c43", margin: 0, fontSize: "0.9rem" }}>{successMsg}</p>
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

            <div className="form-group">
              <label>OTP Code (optional if opened from email button)</label>
              <input
                type="text"
                className="input-style"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit OTP"
              />
            </div>

            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                className="input-style"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                className="input-style"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
              />
            </div>

            <button className="btn btn-primary w-full" type="submit" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>

          <div style={{ marginTop: "1rem", textAlign: "center" }}>
            <Link to="/forgot-password" style={{ color: "var(--brand-secondary)", fontWeight: 600, textDecoration: "none" }}>
              Need new OTP? Send again
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

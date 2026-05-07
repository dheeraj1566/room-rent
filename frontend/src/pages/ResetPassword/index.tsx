import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import "./ResetPassword.css";
import { apiFetch } from "../../lib/api";
import { isValidEmail } from "../../lib/validation";
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
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!isValidEmail(email)) {
      setErrorMsg("Enter a valid email address with a proper domain like gmail.com");
      return;
    }

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
    <div className="auth-shell">
      <div className="auth-container">
        <div className="auth-header">
          <img
            src={brandLogo}
            alt="Roombaazi"
            className="auth-logo"
          />
          <p className="auth-subtitle">
            {tokenFromLink ? "Reset token detected from your email link." : "Enter OTP from email to reset password."}
          </p>
        </div>

        <div className="glass-card">
          <h2 className="text-center mb-5">Reset Password</h2>

          {successMsg && (
            <div className="alert-success">
              <p className="alert-content">{successMsg}</p>
            </div>
          )}
          {errorMsg && (
            <div className="alert-error">
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
              <div className="password-input-wrapper">
                <input
                  type={showNewPassword ? "text" : "password"}
                  className="input-style password-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="input-style password-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button className="btn btn-primary w-full" type="submit" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>

          <div className="auth-links">
            <Link to="/forgot-password" className="auth-link">
              Need new OTP? Send again
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

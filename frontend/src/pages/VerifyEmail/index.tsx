import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { CheckCircle, XCircle, Loader, Mail } from "lucide-react";
import "./VerifyEmail.css";
import brandLogo from "../../assets/Roombaazi Final Logo.png";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { isValidEmail } from "../../lib/validation";

type Status = "verifying" | "success" | "error";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMsg, setErrorMsg] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setErrorMsg("No verification token found in the link.");
      return;
    }

    apiFetch<{ token: string; user: unknown }>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (data) => {
        if (data.token) {
          localStorage.setItem("auth_token", data.token);
        }
        await refreshSession();
        setStatus("success");
        setTimeout(() => navigate("/browse"), 2800);
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Verification failed. The link may have expired.");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResend = async () => {
    if (!resendEmail.trim() || resendStatus === "sending") return;
    if (!isValidEmail(resendEmail)) return;

    setResendStatus("sending");
    try {
      await apiFetch("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: resendEmail.trim() }),
      });
    } catch {
      // silently ignore — response is always generic
    }
    setResendStatus("sent");
  };

  return (
    <div className="app-shell auth-shell">
      <main className="auth-main">
        <div className="page-container">
          <div className="auth-logo-wrap">
            <img src={brandLogo} alt="Roombaazi" />
          </div>

          <div className="surface-card auth-card verify-email-card">
            {status === "verifying" && (
              <>
                <Loader size={48} className="verify-email-loader" />
                <h2 className="verify-email-loading-title">Verifying your email…</h2>
                <p className="verify-email-loading-subtitle">Hang tight, this only takes a second.</p>
              </>
            )}

            {status === "success" && (
              <>
                <CheckCircle size={52} className="verify-email-success-icon" />
                <h2 className="verify-email-success-title">Email Confirmed!</h2>
                <p className="verify-email-success-subtitle">
                  Welcome to Roombaazi! Your account is now active.<br />
                  Redirecting you to browse rooms…
                </p>
                <div className="verify-email-progress-bar">
                  <div className="verify-email-progress-fill" />
                </div>
              </>
            )}

            {status === "error" && (
              <>
                <XCircle size={52} className="verify-email-error-icon" />
                <h2 className="verify-email-error-title">Verification Failed</h2>
                <p className="verify-email-error-message">{errorMsg}</p>

                {resendStatus === "sent" ? (
                  <>
                    <Mail size={36} className="verify-email-resend-icon" />
                    <p className="verify-email-resend-description">
                      A new verification link has been sent if that email exists and is unverified.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="verify-email-resend-label">Get a new verification link</p>
                    <div className="verify-email-resend-inputs">
                      <input
                        className="input-style"
                        type="email"
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        placeholder="Enter your email"
                        onKeyDown={(e) => e.key === "Enter" && handleResend()}
                      />
                      <button
                        className="btn btn-primary btn-md"
                        onClick={handleResend}
                        disabled={resendStatus === "sending" || !resendEmail.trim()}
                      >
                        {resendStatus === "sending" ? "Sending…" : "Resend"}
                      </button>
                    </div>
                  </>
                )}

                <Link to="/login" className="btn btn-outline btn-md">Back to Login</Link>
              </>
            )}
          </div>
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes grow-bar { from { width: 0%; } to { width: 100%; } }
      `}</style>
    </div>
  );
}

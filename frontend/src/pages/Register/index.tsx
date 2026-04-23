import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import brandLogo from "../../assets/Roombaazi Final Logo.png";
import SiteFooter from "../../components/SiteFooter";
import Select from "../../components/Select";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";

const GENDER_OPTIONS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
];

export default function Register() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "Other">("Male");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg("");

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          fullName: fullName.trim(),
          gender,
          email: email.trim(),
          phone: phone.trim(),
          password,
        }),
      });
      await refreshSession();
      navigate("/browse");
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Registration failed");
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

          <div className="surface-card auth-card">
            <h1 style={{ fontSize: "clamp(1.85rem, 4.2vw, 2.35rem)", textAlign: "center", marginBottom: 8 }}>Create Account</h1>
            <p style={{ textAlign: "center", marginBottom: 28 }}>Join thousands of renters &amp; owners</p>

            {errorMsg ? <div className="error-banner">{errorMsg}</div> : null}

            <form onSubmit={handleSubmit}>
              <div className="field" style={{ marginBottom: 18 }}>
                <label>Full Name</label>
                <input
                  className="input-style"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="field" style={{ marginBottom: 18 }}>
                <label>Gender</label>
                <Select
                  value={gender}
                  onChange={(next) => setGender(next as typeof gender)}
                  options={GENDER_OPTIONS}
                  aria-label="Select gender"
                />
              </div>

              <div className="field" style={{ marginBottom: 18 }}>
                <label>Phone Number</label>
                <input
                  className="input-style"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile number"
                  required
                />
              </div>

              <div className="field" style={{ marginBottom: 18 }}>
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

              <div className="field" style={{ marginBottom: 18 }}>
                <label>Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    className="input-style"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter a strong password"
                    style={{ paddingRight: 54 }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={{
                      position: "absolute",
                      right: 18,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      color: "var(--slate-600)",
                      cursor: "pointer",
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="field">
                <label>Confirm Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    className="input-style"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter your password"
                    style={{ paddingRight: 54 }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    style={{
                      position: "absolute",
                      right: 18,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      color: "var(--slate-600)",
                      cursor: "pointer",
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button className="btn btn-dark btn-block" style={{ marginTop: 24 }} disabled={loading}>
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <div className="auth-link-row" style={{ marginTop: 28 }}>
              Already have an account? <Link to="/login">Log in</Link>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Eye, EyeOff, Mail } from "lucide-react";
import "./Register.css";
import brandLogo from "../../assets/Roombaazi Final Logo.png";
import SiteFooter from "../../components/SiteFooter";
import { apiFetch } from "../../lib/api";
import { isValidEmail } from "../../lib/validation";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "Other">("Male");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const passwordRules = [
    {
      key: "length",
      label: "8 to 24 characters",
      valid: password.length >= 8 && password.length <= 24,
    },
    {
      key: "letter",
      label: "At least 1 letter (a–z or A–Z)",
      valid: /[a-zA-Z]/.test(password),
    },
    {
      key: "number",
      label: "At least 1 number (0–9)",
      valid: /\d/.test(password),
    },
  ];

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!fullName.trim()) nextErrors.fullName = "Full name is required";
    if (!phone.trim()) nextErrors.phone = "Phone number is required";
    else if (!/^[6-9]\d{9}$/.test(phone.trim())) nextErrors.phone = "Enter a valid 10-digit mobile number";
    if (!email.trim()) nextErrors.email = "Email address is required";
    else if (!isValidEmail(email)) nextErrors.email = "Enter a valid email address with a proper domain like gmail.com";
    if (!password) nextErrors.password = "Password is required";
    else if (passwordRules.some((rule) => !rule.valid)) nextErrors.password = "Password is not secure and password must be Strong";
    if (!confirmPassword) nextErrors.confirmPassword = "Please confirm your password";
    else if (password !== confirmPassword) nextErrors.confirmPassword = "Passwords do not match";

    return nextErrors;
  };

  const hasStartedPassword = password.length > 0;
  const bottomError = errorMsg || Object.values(fieldErrors)[0] || "";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg("");
    const nextErrors = validateForm();
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
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
      setEmailSent(true);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="app-shell auth-shell">
        <main className="auth-main">
          <div className="page-container">
            <div className="auth-logo-wrap">
              <img src={brandLogo} alt="Roombaazi" />
            </div>
            <div className="surface-card auth-card register-success-card">
              <Mail size={52} className="register-success-icon" />
              <h2 className="register-success-title">Check your inbox</h2>
              <p className="register-success-subtitle">
                We've sent a verification link to
              </p>
              <p className="register-success-email">{email}</p>
              <p className="register-success-instruction">
                Tap the link in the email to confirm your address and activate your Roombaazi account.
                The link expires in 24 hours.
              </p>
              <Link to="/login" className="btn btn-outline btn-md">Back to Login</Link>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="app-shell auth-shell">
      <main className="auth-main">
        <div className="page-container">
          <div className="auth-logo-wrap">
            <img src={brandLogo} alt="Roombaazi" />
          </div>

          <div className="surface-card auth-card">
            <h1 className="register-title-hero">Create Account</h1>
            <p className="register-subtitle-hero">Join thousands of renters &amp; owners</p>

            <form onSubmit={handleSubmit}>
              <div className="field register-field-spacing">
                <label>Full Name</label>
                <input
                  className={`input-style ${fieldErrors.fullName ? "input-error" : ""}`}
                  value={fullName}
                  onChange={(event) => {
                    setFullName(event.target.value);
                    setFieldErrors((prev) => ({ ...prev, fullName: "" }));
                  }}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="field register-field-spacing">
                <label>Gender</label>
                <div className="radio-inline">
                  {(["Male", "Female", "Other"] as const).map((option) => (
                    <label key={option} className="checkbox-item">
                      <input
                        type="radio"
                        name="gender"
                        checked={gender === option}
                        onChange={() => setGender(option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="field register-field-spacing">
                <label>Phone Number</label>
                <input
                  className={`input-style ${fieldErrors.phone ? "input-error" : ""}`}
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value.replace(/\D/g, "").slice(0, 10));
                    setFieldErrors((prev) => ({ ...prev, phone: "" }));
                  }}
                  placeholder="10-digit mobile number"
                  required
                />
              </div>

              <div className="field register-field-spacing">
                <label>Email Address</label>
                <input
                  className={`input-style ${fieldErrors.email ? "input-error" : ""}`}
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setFieldErrors((prev) => ({ ...prev, email: "" }));
                  }}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="field register-field-spacing">
                <label>Password</label>
                <div className="password-input-wrapper">
                  <input
                    className={`input-style password-input ${fieldErrors.password ? "input-error" : ""}`}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setFieldErrors((prev) => ({ ...prev, password: "" }));
                    }}
                    placeholder="Enter a strong password"
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
                {hasStartedPassword ? (
                  <div className="password-rules" aria-live="polite">
                    {passwordRules.map((rule) => (
                      <div key={rule.key} className={`password-rule ${rule.valid ? "valid" : "invalid"}`}>
                        <Check size={14} />
                        <span>{rule.label}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="field">
                <label>Confirm Password</label>
                <div className="password-input-wrapper">
                  <input
                    className={`input-style password-input ${fieldErrors.confirmPassword ? "input-error" : ""}`}
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
                    }}
                    placeholder="Re-enter your password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {bottomError ? <div className="form-error-summary">{bottomError}</div> : null}

              <button className="btn btn-dark btn-block register-submit-btn" disabled={loading}>
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <div className="auth-link-row register-login-row">
              Already have an account? <Link to="/login">Log in</Link>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

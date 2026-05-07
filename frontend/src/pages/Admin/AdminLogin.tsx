import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, simpleApi } from "../../lib/simpleApi";
import { isValidEmail } from "../../lib/validation";

interface AdminLoginResponse {
  user: {
    role: string;
  };
  token?: string;
}

const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isValidEmail(email)) {
      setError("Enter a valid email address with a proper domain like gmail.com");
      return;
    }

    try {
      const res = await simpleApi.post<AdminLoginResponse>("/auth/login", { email, password });
      if (res.user.role !== "admin") {
        setError("Access denied: Not an admin user.");
        return;
      }
      // Save token/cookie as needed
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    }
  };

  return (
    <div className="admin-login">
      <h2>Admin Login</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Admin Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <button type="submit">Login</button>
        {error && <div className="error">{error}</div>}
      </form>
    </div>
  );
};

export default AdminLogin;

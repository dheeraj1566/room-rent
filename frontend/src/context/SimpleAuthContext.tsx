import React, { createContext, useContext, useEffect, useState } from "react";
import { api, TokenManager } from "../lib/simpleApi";

interface User {
  id: string;
  email: string;
  role: string;
  hasFullName?: boolean;
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasGender?: boolean;
  hasPhoto?: boolean;
  hasAadhaar?: boolean;
}

interface RegisterData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  gender: "Male" | "Female" | "Other";
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const response = await api.get<{ user: User }>("/api/auth/me");
      setUser(response.user);
    } catch {
      setUser(null);
      TokenManager.clear();
    }
  };

  const login = async (email: string, password: string) => {
    const response = await api.post<{ user: User; token: string }>(
      "/api/auth/login",
      { email, password },
    );

    TokenManager.set(response.token);
    setUser(response.user);
  };

  const register = async (data: RegisterData) => {
    const response = await api.post<{ user: User; token: string }>(
      "/api/auth/register",
      data,
    );

    TokenManager.set(response.token);
    setUser(response.user);
  };

  const logout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      TokenManager.clear();
      setUser(null);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      if (TokenManager.get()) {
        await refreshUser();
      }
      setLoading(false);
    };

    void checkAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: "24px", textAlign: "center" }}>Loading...</div>;
  }

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  return <>{children}</>;
}
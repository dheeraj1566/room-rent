import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import Home from "./pages/Home/index";
import Dashboard from "./pages/Dashboard/index";
import AddListing from "./pages/AddListing/index";
import ListingsPage from "./pages/Listings/index";
import ListingDetailsPage from "./pages/ListingDetails/index";
import Login from "./pages/Login/index";
import Register from "./pages/Register/index";
import ForgotPassword from "./pages/ForgotPassword/index";
import ResetPassword from "./pages/ResetPassword/index";
import ProfilePage from "./pages/Profile/index";
import LikedPropertiesPage from "./pages/LikedProperties/index";
import Skeleton from "./components/Skeleton";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: "24px" }}>
        <Skeleton style={{ height: 86, borderRadius: 24, marginBottom: 16 }} />
        <Skeleton style={{ height: 420, borderRadius: 24 }} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Register />} />
      <Route path="/register" element={<Navigate to="/signup" replace />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/browse"
        element={
          <ProtectedRoute>
            <ListingsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/listings" element={<Navigate to="/browse" replace />} />
      <Route
        path="/listings/:listingId"
        element={
          <ProtectedRoute>
            <ListingDetailsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-properties"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/dashboard" element={<Navigate to="/my-properties" replace />} />
      <Route
        path="/post-property"
        element={
          <ProtectedRoute>
            <AddListing />
          </ProtectedRoute>
        }
      />
      <Route path="/add-listing" element={<Navigate to="/post-property" replace />} />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/liked-properties"
        element={
          <ProtectedRoute>
            <LikedPropertiesPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}

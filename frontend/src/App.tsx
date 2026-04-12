import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Home from './pages/Home/index';
import Dashboard from './pages/Dashboard/index';
import AddListing from './pages/AddListing/index';
import ListingsPage from './pages/Listings/index';
import ListingDetailsPage from './pages/ListingDetails/index';
import Login from './pages/Login/index';
import Register from './pages/Register/index';
import ForgotPassword from './pages/ForgotPassword/index';
import ResetPassword from './pages/ResetPassword/index';
import ProfilePage from './pages/Profile/index';
import Skeleton from './components/Skeleton';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ padding: '1.5rem', width: '100%' }}>
        <Skeleton style={{ height: '64px', marginBottom: '1rem' }} />
        <Skeleton style={{ height: '300px' }} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          <Route path="/listings" element={<ProtectedRoute><ListingsPage /></ProtectedRoute>} />
          <Route path="/listings/:listingId" element={<ProtectedRoute><ListingDetailsPage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/add-listing" element={<ProtectedRoute><AddListing /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;

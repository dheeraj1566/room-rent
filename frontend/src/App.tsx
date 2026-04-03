import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard/index';
import AddListing from './pages/AddListing/index';
import ListingsPage from './pages/Listings/index';
import Login from './pages/Login/index';
import Register from './pages/Register/index';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-center mt-4">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

<<<<<<< Updated upstream
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-center mt-4">Loading...</div>;
  if (user) return <Navigate to="/listings" replace />;
  return <>{children}</>;
=======
function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <>
      {user && (
        <nav className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem 2rem' }}>
          <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--brand-primary)' }}>
            RoomRent
          </div>
          <button className="btn btn-outline" onClick={logout} style={{ padding: '0.4rem 1rem' }}>
            Logout
          </button>
        </nav>
      )}
      {children}
    </>
  );
>>>>>>> Stashed changes
}

function App() {
  return (
    <AuthProvider>
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
<<<<<<< Updated upstream
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          
          <Route path="/" element={<ProtectedRoute><Navigate to="/listings" replace /></ProtectedRoute>} />
          <Route path="/listings" element={<ProtectedRoute><ListingsPage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/add-listing" element={<ProtectedRoute><AddListing /></ProtectedRoute>} />
        </Routes>
=======
        <Layout>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route path="/home" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/add-listing" element={<ProtectedRoute><AddListing /></ProtectedRoute>} />
            <Route path="/" element={<Navigate to="/home" replace />} />
          </Routes>
        </Layout>
>>>>>>> Stashed changes
      </div>
    </AuthProvider>
  );
}

export default App;

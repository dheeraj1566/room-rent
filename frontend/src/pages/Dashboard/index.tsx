import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="glass-card text-center" style={{ marginTop: '10%' }}>
      <h1>Account Dashboard</h1>
      <p className="mb-4">
        Welcome back{user?.email ? `, ${user.email}` : ""}
        {user?.role ? ` (${user.role})` : ""}! Ready to continue?
      </p>
      
      <div className="flex-row" style={{ justifyContent: "center", marginTop: '1rem' }}>
        <Link to="/profile" style={{ textDecoration: 'none' }}>
          <button className="btn btn-outline">My Profile</button>
        </Link>
        <Link to="/add-listing" style={{ textDecoration: 'none' }}>
          <button className="btn btn-primary">
            <PlusCircle size={20} />
            Add New Listing
          </button>
        </Link>
        <button className="btn btn-outline" onClick={logout}>
          Logout
        </button>
      </div>
    </div>
  );
}

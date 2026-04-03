import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Building } from 'lucide-react';

interface Listing {
  ListingId: string;
  Title: string;
  MonthlyRent: number;
  StatusId: number;
  CreatedAt: string;
  AvailableFrom: string;
  Colony: string;
}

export default function Dashboard() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:5000/api/listings/my", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.listings) {
          setListings(data.listings);
        }
      })
      .catch(err => console.error("Error fetching listings", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-col" style={{ gap: '2rem', height: '100%' }}>
      <div className="glass-card text-center" style={{ marginTop: '2rem' }}>
        <h1>Landlord Dashboard</h1>
        <p className="mb-4">Welcome back! Ready to list a new property?</p>
        
        <Link to="/add-listing" style={{ textDecoration: 'none' }}>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }}>
            <PlusCircle size={20} />
            Add New Listing
          </button>
        </Link>
      </div>

      <div className="glass-card" style={{ flex: 1 }}>
        <h2 className="mb-4 flex-row" style={{ justifyContent: 'flex-start' }}>
          <Building size={24} style={{ marginRight: '0.5rem', color: 'var(--brand-primary)' }} /> Your Listed Rooms
        </h2>
        {loading ? (
          <p className="text-center text-muted">Loading your listings...</p>
        ) : listings.length === 0 ? (
          <p className="text-center text-muted">You haven't listed any rooms yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {listings.map(listing => (
              <div key={listing.ListingId} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', lineHeight: '1.4' }}>{listing.Title}</h3>
                <p style={{ color: 'var(--brand-primary)', fontWeight: 'bold', fontSize: '1.2rem' }}>₹{listing.MonthlyRent}<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/mo</span></p>
                <div style={{ margin: '1rem 0', color: 'var(--text-muted)', fontSize: '0.9rem', flex: 1 }}>
                  <p style={{ marginBottom: '0.5rem' }}>📍 {listing.Colony}</p>
                  <p>📅 Available: {new Date(listing.AvailableFrom).toLocaleDateString()}</p>
                </div>
                <div>
                  <span style={{ 
                    display: 'inline-block',
                    background: listing.StatusId === 1 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: listing.StatusId === 1 ? '#10b981' : '#ef4444',
                    padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold'
                  }}>
                    {listing.StatusId === 1 ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

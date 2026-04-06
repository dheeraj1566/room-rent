import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MapPin } from 'lucide-react';

type ListingCardProps = {
  listingId: string;
  title: string;
  colony: string;
  city: string;
  monthlyRent: number;
  maxOccupants: number;
  furnishingName: string;
  foodPreferenceName: string;
  coverPhotoUrl: string | null;
};

export default function ListingCard(props: ListingCardProps) {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFavorite(!isFavorite);
  };

  return (
    <article
      className="listing-card"
      onClick={() => navigate(`/listings/${props.listingId}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/listings/${props.listingId}`);
        }
      }}
    >
      <div className="listing-card-image">
        <div className="listing-card-badge">
          {props.maxOccupants} {props.maxOccupants === 1 ? 'BHK' : 'BHK'}
        </div>
        <div 
          className="listing-card-favorite"
          onClick={handleFavoriteClick}
          role="button"
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart 
            size={20} 
            fill={isFavorite ? "currentColor" : "none"}
            style={{ color: isFavorite ? '#ef4444' : 'currentColor' }}
          />
        </div>
        
        {props.coverPhotoUrl && !imageError ? (
          <img
            src={props.coverPhotoUrl}
            alt={props.title}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="listing-card-placeholder">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        )}
      </div>

      <div className="listing-card-content">
        <div className="listing-card-price">
          ₹{Number(props.monthlyRent).toLocaleString('en-IN')}
          <span className="listing-card-price-label">/mo</span>
        </div>
        <h3 className="listing-card-title">{props.title}</h3>
        <p className="listing-card-location">
          <MapPin size={16} />
          {props.colony}, {props.city}
        </p>
        
        <div className="listing-card-features">
          <span className="feature-tag">{props.maxOccupants} {props.maxOccupants === 1 ? 'Person' : 'People'}</span>
          <span className="feature-tag">{props.furnishingName}</span>
        </div>
      </div>
    </article>
  );
}

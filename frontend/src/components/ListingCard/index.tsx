import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BedDouble, Heart, Home, MapPin, Sofa, Users } from "lucide-react";
import "./ListingCard.css";

type ListingCardProps = {
  listingId: string;
  title: string;
  colony: string;
  city: string;
  monthlyRent: number;
  rentTiers: { occupants: number; rent: number }[];
  maxOccupants: number;
  landlordGender: string | null;
  roomFor: string | null;
  propertyTypeId: number | null;
  furnishingName: string;
  foodPreferenceName: string;
  coverPhotoUrl: string | null;
  isFavorited?: boolean;
  onToggleFavorite?: (listingId: string) => void;
  createdAt?: string;
};

const propertyTypeMap: Record<number, string> = {
  1: "PG",
  2: "Independent Room",
  3: "Flat",
  4: "Studio",
};

function formatRelativeTime(value?: string) {
  if (!value) return "Recently";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "Recently";
  const diffHours = Math.max(1, Math.floor((Date.now() - time) / (1000 * 60 * 60)));
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  const diffDays = Math.max(1, Math.floor(diffHours / 24));
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

export default function ListingCard({
  listingId,
  title,
  colony,
  city,
  monthlyRent,
  maxOccupants,
  propertyTypeId,
  furnishingName,
  roomFor,
  coverPhotoUrl,
  isFavorited,
  onToggleFavorite,
  createdAt,
}: ListingCardProps) {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  const propertyLabel = propertyTypeId ? propertyTypeMap[propertyTypeId] ?? "Property" : "Property";
  const relativeTime = useMemo(() => formatRelativeTime(createdAt), [createdAt]);
  const titleAccent = /studio/i.test(title) || /mansarovar/i.test(title);
  const occupantIcons = Math.min(Math.max(maxOccupants, 1), 4);

  return (
    <article
      className="listing-card listing-card-wrapper"
      onClick={() => navigate(`/listings/${listingId}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(`/listings/${listingId}`);
        }
      }}
    >
      <div className="listing-card-image-wrapper">
        <div className="listing-card-badges">
          <div className="listing-card-badges-left">
            <span className="badge badge-dark listing-card-badge">
              {propertyLabel}
            </span>
            <span className="badge badge-verified listing-card-badge">
              Verified
            </span>
          </div>

          <button
            className={`listing-card-favorite ${isFavorited ? "active" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite?.(listingId);
            }}
            aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart size={18} fill={isFavorited ? "currentColor" : "none"} />
          </button>
        </div>

        {coverPhotoUrl && !imageError ? (
          <img className="listing-card-image" src={coverPhotoUrl} alt={title} onError={() => setImageError(true)} />
        ) : (
          <div className="listing-card-placeholder">
            <Home size={74} />
            <span className="listing-card-placeholder-text">NO IMAGE YET</span>
          </div>
        )}
      </div>

      <div className="listing-card-content">
        <div className="listing-card-price-row">
          <div className="listing-card-price">
            ₹{monthlyRent.toLocaleString("en-IN")}
            <span>/mo</span>
          </div>
          <span className="listing-card-time">{relativeTime}</span>
        </div>

        <h3 className={`listing-card-title ${titleAccent ? "highlight" : ""}`}>{title}</h3>

        <div className="listing-card-location">
          <MapPin size={15} />
          {colony}, {city}
        </div>

        <div className="listing-card-meta">
          <span className="listing-card-meta-item">
            <span className="occupant-icon-group" aria-hidden="true">
              {Array.from({ length: occupantIcons }, (_, index) => (
                <Users key={`${listingId}-occupant-${index}`} size={14} />
              ))}
            </span>
            <span>{maxOccupants} {maxOccupants === 1 ? "occupant" : "occupants"}</span>
          </span>
          <span className="listing-card-meta-item">
            <Sofa size={14} />
            {furnishingName}
          </span>
          <span className="listing-card-meta-item listing-card-meta-item-highlighted">
            <BedDouble size={14} />
            Amenities
          </span>
          {roomFor ? (
            <span className="listing-card-meta-item">
              <Users size={14} />
              {roomFor}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
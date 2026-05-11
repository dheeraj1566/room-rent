import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BadgeIndianRupee,
  BedDouble,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Heart,
  Home,
  MapPin,
  Pencil,
  ShieldCheck,
  Sofa,
  Star,
  Users,
  Utensils,
} from "lucide-react";
import { ApiError, apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import Navbar from "../../components/Navbar";
import SiteFooter from "../../components/SiteFooter";
import Skeleton from "../../components/Skeleton";
import "./ListingDetails.css";

type ListingPhoto = {
  photoType: "Room" | "Exterior";
  photoUrl: string;
  displayOrder: number;
};

type ListingDetails = {
  listingId: string;
  landlordId: string;
  landlordName: string;
  title: string;
  description: string | null;
  roomCategoryId: number;
  roomCategoryName: string;
  floorLevelId: number;
  floorName: string;
  furnishingTypeId: number;
  furnishingName: string;
  maxOccupants: number;
  allowSmoking: boolean;
  foodPreferenceId: number;
  preferenceName: string;
  monthlyRent: number;
  rentTiers?: { occupants: number; rent: number }[];
  securityDeposit: number | null;
  availableFrom: string;
  addressLine: string;
  colony: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  statusId: number;
  createdAt: string;
  propertyTypeId: number | null;
  propertyTypeName: string | null;
  foodLevelId: number | null;
  bedType: string | null;
  singleBedCount: number | null;
  doubleBedCount: number | null;
  roomFor: string | null;
  coverPhotoUrl: string | null;
  photos: ListingPhoto[];
};

type EditForm = {
  monthlyRent: number;
  maxOccupants: number;
  allowSmoking: boolean;
  availableFrom: string;
  description: string;
  securityDeposit: number;
  exteriorPhotoUrl: string;
  roomPhotoUrls: string[];
};

type TestimonialItem = {
  testimonialId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerPhoto: string | null;
  reviewerGender: string | null;
  rating: number;
  body: string;
  reviewerRole: "Tenant" | "Landlord";
  createdAt: string;
};

type ConnectionStatus = {
  connectionId: string;
  status: "Pending" | "Accepted" | "Rejected";
  isConnected: boolean;
} | null;

const propertyTypeMap: Record<number, string> = {
  1: "PG",
  2: "Individual",
  3: "Flat",
};

function formatDisplayDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ReviewStars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <div className="listing-details-review-stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          fill={star <= value ? "var(--orange-500)" : "none"}
          stroke={star <= value ? "var(--orange-500)" : "var(--slate-500)"}
        />
      ))}
    </div>
  );
}

export default function ListingDetailsPage() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { showToast } = useToast();

  const [item, setItem] = useState<ListingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [sliderIndex, setSliderIndex] = useState(0);

  const [isEditing, setIsEditing] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editExteriorFile, setEditExteriorFile] = useState<File | null>(null);
  const [editRoomFiles, setEditRoomFiles] = useState<Array<File | null>>([null, null]);

  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [testimonialsLoading, setTestimonialsLoading] = useState(false);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [myReview, setMyReview] = useState<{ rating: number; body: string } | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewHover, setReviewHover] = useState(0);
  const [submittingReview, setSubmittingReview] = useState(false);

  const [myConnection, setMyConnection] = useState<ConnectionStatus>(null);
  const [connectingOwner, setConnectingOwner] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriting, setFavoriting] = useState(false);

  const canEdit = Boolean(user && item && user.id === item.landlordId);

  const allPhotos = useMemo(() => {
    if (!item) return [];
    return item.photos.length > 0
      ? item.photos
      : item.coverPhotoUrl
        ? [{ photoType: "Exterior", photoUrl: item.coverPhotoUrl, displayOrder: 1 } as ListingPhoto]
        : [];
  }, [item]);

  const mapUrl = useMemo(() => {
    if (!item) return "";
    return `https://maps.google.com/maps?q=${item.latitude},${item.longitude}&z=15&output=embed`;
  }, [item]);

  const loadConnectionStatus = async (currentListingId: string) => {
    if (!user) return;
    try {
      const data = await apiFetch<{ connection: ConnectionStatus }>(
        `/api/connections/my-status/${currentListingId}`,
        { method: "GET" },
      );
      setMyConnection(data.connection);
    } catch {
      setMyConnection(null);
    }
  };

  const loadFavoriteStatus = async (currentListingId: string) => {
    if (!user) {
      setIsFavorited(false);
      return;
    }
    try {
      const data = await apiFetch<{ ids: string[] }>("/api/favorites/ids", { method: "GET" });
      setIsFavorited(Array.isArray(data.ids) && data.ids.includes(currentListingId));
    } catch {
      setIsFavorited(false);
    }
  };

  const loadTestimonials = async (landlordId: string) => {
    setTestimonialsLoading(true);
    try {
      const data = await apiFetch<{ items: TestimonialItem[]; avgRating: number | null }>(
        `/api/testimonials/subject/${landlordId}`,
        { method: "GET" },
      );
      setTestimonials(Array.isArray(data.items) ? data.items : []);
      setAvgRating(data.avgRating);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load reviews", "error");
    } finally {
      setTestimonialsLoading(false);
    }
  };

  const loadMyReview = async (landlordId: string, currentListingId: string) => {
    if (!user) return;
    try {
      const data = await apiFetch<{ review: { rating: number; body: string } | null }>(
        `/api/testimonials/mine/${landlordId}?listingId=${currentListingId}`,
        { method: "GET" },
      );
      if (data.review) {
        setMyReview(data.review);
        setReviewRating(data.review.rating);
        setReviewBody(data.review.body);
      } else {
        setMyReview(null);
      }
    } catch {
      setMyReview(null);
    }
  };

  const loadListing = async () => {
    if (!listingId) {
      setErrorMsg("Invalid listing id");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const data = await apiFetch<ListingDetails>(`/api/listings/${listingId}`, { method: "GET" });
      setItem(data);
      setSliderIndex(0);

      const exterior = data.photos.find((photo) => photo.photoType === "Exterior")?.photoUrl || "";
      const roomUrls = data.photos
        .filter((photo) => photo.photoType === "Room")
        .map((photo) => photo.photoUrl)
        .slice(0, 2);

      setEditForm({
        monthlyRent: Number(data.monthlyRent),
        maxOccupants: Number(data.maxOccupants),
        allowSmoking: Boolean(data.allowSmoking),
        availableFrom: String(data.availableFrom).slice(0, 10),
        description: data.description || "",
        securityDeposit: Number(data.securityDeposit || 0),
        exteriorPhotoUrl: exterior,
        roomPhotoUrls: [roomUrls[0] || "", roomUrls[1] || ""],
      });
      setEditExteriorFile(null);
      setEditRoomFiles([null, null]);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }
      setErrorMsg(error instanceof Error ? error.message : "Failed to load listing");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadListing();
  }, [listingId]);

  useEffect(() => {
    if (!item) return;
    void loadTestimonials(item.landlordId);
    void loadMyReview(item.landlordId, item.listingId);
    void loadFavoriteStatus(item.listingId);
    if (user && user.id !== item.landlordId) {
      void loadConnectionStatus(item.listingId);
    }
  }, [item?.landlordId, item?.listingId, user?.id]);

  const handleCancelRequest = async () => {
    if (!myConnection) return;
    setCancellingRequest(true);
    try {
      await apiFetch(`/api/connections/${myConnection.connectionId}`, { method: "DELETE" });
      setMyConnection(null);
      showToast("Request cancelled", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to cancel request", "error");
    } finally {
      setCancellingRequest(false);
    }
  };

  const handleConnectOwner = async () => {
    if (!item || !user) return;
    setConnectingOwner(true);
    try {
      const data = await apiFetch<{ connectionId: string; status: string; isConnected: boolean }>(
        "/api/connections",
        {
          method: "POST",
          body: JSON.stringify({ listingId: item.listingId }),
        },
      );
      setMyConnection({
        connectionId: data.connectionId,
        status: data.status as "Pending" | "Accepted" | "Rejected",
        isConnected: data.isConnected,
      });
      showToast("Connection request sent to owner", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to send request", "error");
    } finally {
      setConnectingOwner(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!item || !user) return;
    setSubmittingReview(true);
    try {
      await apiFetch("/api/testimonials", {
        method: "POST",
        body: JSON.stringify({
          subjectId: item.landlordId,
          listingId: item.listingId,
          rating: reviewRating,
          body: reviewBody,
          reviewerRole: "Tenant",
        }),
      });
      setMyReview({ rating: reviewRating, body: reviewBody });
      showToast("Review submitted successfully", "success");
      await loadTestimonials(item.landlordId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to submit review", "error");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!item) return;
    if (!user) {
      navigate("/login");
      return;
    }

    setFavoriting(true);
    try {
      const data = await apiFetch<{ liked: boolean }>(`/api/favorites/${item.listingId}`, { method: "POST" });
      setIsFavorited(Boolean(data.liked));
      showToast(data.liked ? "Added to liked properties" : "Removed from liked properties", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to update liked status", "error");
    } finally {
      setFavoriting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!item || !editForm) return;
    setIsSavingEdit(true);
    setErrorMsg("");

    try {
      const address = `${item.addressLine}, ${item.colony}, ${item.city}, ${item.state}, ${item.pincode}`;
      const formData = new FormData();
      formData.append(
        "data",
        JSON.stringify({
          address,
          room: {
            floorLevelId: item.floorLevelId,
            maxOccupants: editForm.maxOccupants,
            foodPreferenceId: item.foodPreferenceId,
            allowSmoking: editForm.allowSmoking,
            monthlyRent: editForm.monthlyRent,
            furnishingTypeId: item.furnishingTypeId,
            availableFrom: editForm.availableFrom,
            description: editForm.description,
            securityDeposit: editForm.securityDeposit,
            propertyTypeId: item.propertyTypeId ?? undefined,
            roomCategoryId: item.roomCategoryId ?? undefined,
            foodLevelId: item.foodLevelId ?? undefined,
            bedType: item.bedType ? (item.bedType as "Single" | "Double" | "Mixed") : undefined,
            singleBedCount: item.singleBedCount ?? undefined,
            doubleBedCount: item.doubleBedCount ?? undefined,
          },
          exteriorPhotoUrl: editExteriorFile ? "" : editForm.exteriorPhotoUrl.trim(),
          roomPhotoUrls: editForm.roomPhotoUrls.map((url, index) => (editRoomFiles[index] ? "" : url.trim())),
        }),
      );

      if (editExteriorFile) {
        formData.append("exteriorFile", editExteriorFile);
      }

      editRoomFiles.forEach((file, index) => {
        if (file) formData.append(`roomFile-${index}`, file);
      });

      await apiFetch<{ message: string }>(`/api/listings/${item.listingId}`, {
        method: "PUT",
        body: formData,
      });

      setIsEditing(false);
      showToast("Listing updated successfully", "success");
      await loadListing();
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }
      setErrorMsg(error instanceof Error ? error.message : "Failed to update listing");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const detailItems = item
    ? [
        { label: "Property Type", value: item.propertyTypeId ? propertyTypeMap[item.propertyTypeId] || "N/A" : "N/A", icon: <Home size={16} /> },
        { label: "Room Category", value: item.roomCategoryName, icon: <Users size={16} /> },
        { label: "Floor", value: item.floorName, icon: <Home size={16} /> },
        { label: "Furnishing", value: item.furnishingName, icon: <Sofa size={16} /> },
        { label: "Max Occupants", value: `${item.maxOccupants} ${item.maxOccupants === 1 ? "Person" : "People"}`, icon: <Users size={16} /> },
        { label: "Food Preference", value: item.preferenceName, icon: <Utensils size={16} /> },
        { label: "Smoking", value: item.allowSmoking ? "Allowed" : "Not Allowed", icon: <ShieldCheck size={16} /> },
        { label: "Available From", value: formatDisplayDate(item.availableFrom), icon: <CalendarDays size={16} /> },
        ...(item.bedType ? [{ label: "Bed Type", value: item.bedType, icon: <BedDouble size={16} /> }] : []),
        ...(item.singleBedCount ? [{ label: "Single Beds", value: String(item.singleBedCount), icon: <BedDouble size={16} /> }] : []),
        ...(item.doubleBedCount ? [{ label: "Double Beds", value: String(item.doubleBedCount), icon: <BedDouble size={16} /> }] : []),
        ...(item.roomFor ? [{ label: "Room For", value: item.roomFor, icon: <Users size={16} /> }] : []),
      ]
    : [];

  return (
    <div className="app-shell">
      <Navbar />

      <main className="page-shell">
        <section className="page-section">
          <div className="page-container">
            {loading ? (
              <div className="details-layout">
                <div className="listing-details-skeleton-wrapper">
                  <div className="surface-card listing-details-image-card">
                    <Skeleton className="listing-details-skeleton-main" />
                    <div className="listing-details-skeleton-thumbnails">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="listing-details-skeleton-thumbnail" />
                      ))}
                    </div>
                  </div>
                  <Skeleton className="listing-details-skeleton-info" />
                  <Skeleton className="listing-details-skeleton-landlord" />
                </div>
                <Skeleton className="listing-details-skeleton-sidebar" />
              </div>
            ) : errorMsg ? (
              <div className="error-banner">{errorMsg}</div>
            ) : item ? (
              <div className="details-layout details-layout--loaded">
                <div className="listing-details-content">
                  <section className="surface-card listing-details-image-card">
                    <div className="listing-details-image-viewer">
                      {allPhotos.length > 0 ? (
                        <img
                          key={sliderIndex}
                          src={allPhotos[sliderIndex].photoUrl}
                          alt={item.title}
                          className="listing-details-image-main"
                        />
                      ) : (
                        <div className="listing-card-placeholder listing-details-image-placeholder">
                          <Home size={72} />
                          <span className="listing-details-image-placeholder-text">NO IMAGE YET</span>
                        </div>
                      )}

                      {allPhotos.length > 1 && (
                        <>
                          <button
                            onClick={() => setSliderIndex((i) => (i - 1 + allPhotos.length) % allPhotos.length)}
                            className="listing-details-nav-btn listing-details-nav-btn-prev"
                          >
                            <ChevronLeft size={20} />
                          </button>
                          <button
                            onClick={() => setSliderIndex((i) => (i + 1) % allPhotos.length)}
                            className="listing-details-nav-btn listing-details-nav-btn-next"
                          >
                            <ChevronRight size={20} />
                          </button>
                          <div className="listing-details-thumbnails-overlay">
                            {allPhotos.map((photo, i) => (
                              <button
                                key={i}
                                onClick={() => setSliderIndex(i)}
                                className={`listing-details-thumb-btn${i === sliderIndex ? " is-active" : ""}`}
                              >
                                <img
                                  src={photo.photoUrl}
                                  alt={`${item.title} preview ${i + 1}`}
                                  className="listing-details-thumb-image"
                                />
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </section>

                  <section className="surface-card listing-details-property-card">
                    <div className="listing-details-info-header">
                      <div>
                        <span className="badge badge-soft listing-details-badge">
                          <Clock3 size={14} />
                          Added {formatDisplayDate(item.createdAt)}
                        </span>
                        <h1 className="listing-details-page-title">{item.title}</h1>
                        <p className="listing-details-page-location">
                          <MapPin size={16} />
                          {item.addressLine}, {item.colony}, {item.city}, {item.state} - {item.pincode}
                        </p>
                      </div>

                      {canEdit ? (
                        <button className="btn btn-dark btn-sm" onClick={() => setIsEditing(true)}>
                          <Pencil size={16} />
                          Edit Property
                        </button>
                      ) : null}
                    </div>

                    <div className={`listing-card-meta${item.description ? " listing-details-meta-wrapper" : ""}`}>
                      <span className="listing-card-meta-item">
                        <BadgeIndianRupee size={16} />
                        ₹{item.monthlyRent.toLocaleString("en-IN")}/month
                      </span>
                      <span className="listing-card-meta-item">
                        <Users size={16} />
                        {item.roomCategoryName} room
                      </span>
                      <span className="listing-card-meta-item">
                        <Users size={16} />
                        Up to {item.maxOccupants} occupants
                      </span>
                      <span className="listing-card-meta-item">
                        <ShieldCheck size={16} />
                        {item.statusId === 1 ? "Active listing" : "Not active"}
                      </span>
                    </div>

                    {item.description ? (
                      <div className="listing-details-about-section">
                        <h2 className="listing-details-about-title">About this property</h2>
                        <p>{item.description}</p>
                      </div>
                    ) : null}
                  </section>

                  <section className="surface-card listing-details-property-card">
                    <h2 className="listing-details-section-title">Property Details</h2>
                    <div className="listing-details-property-grid">
                      {detailItems.map((detail) => (
                        <div key={detail.label} className="listing-details-property-item">
                          <div className="listing-details-property-label">
                            {detail.icon}
                            {detail.label}
                          </div>
                          <div className="listing-details-property-value">{detail.value}</div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="surface-card listing-details-location-card">
                    <h2 className="listing-details-section-title">Location</h2>
                    <div className="listing-details-map-container">
                      <iframe
                        title="Property location"
                        src={mapUrl}
                        className="listing-details-map-iframe"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  </section>

                  <section className="surface-card listing-details-reviews-card">
                    <div className="listing-details-reviews-header">
                      <div>
                        <h2 className="listing-details-reviews-title">Landlord Reviews</h2>
                        <p>
                          {avgRating ? `${avgRating.toFixed(1)} ★` : "No rating yet"} · {testimonials.length} review{testimonials.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      {avgRating ? <ReviewStars value={Math.round(avgRating)} /> : null}
                    </div>

                    {testimonialsLoading ? (
                      <Skeleton className="listing-details-review-skeleton" />
                    ) : testimonials.length === 0 ? (
                      <div className="listing-details-review-empty">
                        <p>No reviews yet.</p>
                      </div>
                    ) : (
                      <div className="listing-details-review-list">
                        {testimonials.map((testimonial) => (
                          <div key={testimonial.testimonialId} className="listing-details-review-item">
                            <div className="listing-details-review-item-header">
                              <div className="listing-details-review-avatar">
                                {testimonial.reviewerPhoto ? (
                                  <img
                                    src={testimonial.reviewerPhoto}
                                    alt={testimonial.reviewerName}
                                    className="listing-details-review-avatar-image"
                                  />
                                ) : (
                                  testimonial.reviewerName.charAt(0).toUpperCase()
                                )}
                              </div>

                              <div>
                                <div className="listing-details-review-name">{testimonial.reviewerName}</div>
                                <div className="listing-details-review-meta">
                                  {testimonial.reviewerRole} · {formatDisplayDate(testimonial.createdAt)}
                                </div>
                              </div>

                              <div className="listing-details-review-stars-right">
                                <ReviewStars value={testimonial.rating} size={14} />
                              </div>
                            </div>

                            <p>{testimonial.body}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {!user ? (
                      <div className="listing-details-review-note">
                        <p>
                          <a href="/login" className="link-accent">Log in</a> to write a review.
                        </p>
                      </div>
                    ) : user.id === item.landlordId ? (
                      <div className="listing-details-review-note">
                        <p>You cannot review your own listing.</p>
                      </div>
                    ) : !myConnection?.isConnected ? (
                      <div className="listing-details-review-note">
                        <p>Connect with the owner and get your deal confirmed to leave a review.</p>
                      </div>
                    ) : (
                      <div className="listing-details-review-note">
                        <h3 className="listing-details-review-form-title">{myReview ? "Edit Your Review" : "Write a Review"}</h3>
                        <div className="listing-details-review-stars-form">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onMouseEnter={() => setReviewHover(star)}
                              onMouseLeave={() => setReviewHover(0)}
                              onClick={() => setReviewRating(star)}
                              className="listing-details-review-star-btn"
                            >
                              <Star
                                size={22}
                                fill={(reviewHover || reviewRating) >= star ? "var(--orange-500)" : "none"}
                                stroke={(reviewHover || reviewRating) >= star ? "var(--orange-500)" : "var(--slate-500)"}
                              />
                            </button>
                          ))}
                        </div>

                        <textarea
                          className="textarea-style"
                          value={reviewBody}
                          onChange={(event) => setReviewBody(event.target.value)}
                          placeholder="Share your experience with this landlord..."
                          maxLength={1000}
                        />

                        <button
                          className="btn btn-primary listing-details-review-submit"
                          onClick={() => void handleSubmitReview()}
                          disabled={submittingReview || reviewBody.trim().length === 0}
                        >
                          {submittingReview ? "Submitting..." : myReview ? "Update Review" : "Submit Review"}
                        </button>
                      </div>
                    )}
                  </section>
                </div>

                <aside className="details-sidebar listing-details-sidebar-sticky">
                  <div className="surface-card listing-details-sidebar-card">
                    <div className="listing-details-sidebar-price-block">
                      <div className="listing-details-sidebar-price">
                        ₹{Number(item.monthlyRent).toLocaleString("en-IN")}
                        <span className="listing-details-sidebar-price-unit">/month</span>
                      </div>
                      <p className="listing-details-sidebar-occupants">
                        {item.roomCategoryName === "Shared"
                          ? `Shared room for up to ${item.maxOccupants} occupants`
                          : item.roomCategoryName === "Unshared"
                            ? `Entire room for up to ${item.maxOccupants} occupants`
                            : "Single occupancy room"}
                      </p>

                      {Array.isArray(item.rentTiers) && item.rentTiers.length > 0 ? (
                        <div className="listing-details-rent-tiers">
                          {[...item.rentTiers]
                            .sort((a, b) => b.occupants - a.occupants)
                            .map((tier) => (
                              <div key={tier.occupants} className="listing-details-rent-tier-row">
                                <span>{tier.occupants} occupant{tier.occupants > 1 ? "s" : ""}</span>
                                <strong>₹{Number(tier.rent).toLocaleString("en-IN")}</strong>
                              </div>
                            ))}
                        </div>
                      ) : null}

                      {item.securityDeposit && item.securityDeposit > 0 ? (
                        <p className="listing-details-security-deposit">
                          Security Deposit: ₹{Number(item.securityDeposit).toLocaleString("en-IN")}
                        </p>
                      ) : null}
                    </div>

                    <div className="listing-details-owner-box">
                      <div className="listing-details-owner-label">
                        Property Owner
                      </div>
                      <div className="listing-details-owner-name">{item.landlordName}</div>
                    </div>

                    {!canEdit ? (
                      <div className="listing-details-connect-block">
                        {!user ? (
                          <button className="btn btn-primary btn-block" onClick={() => navigate("/login")}>
                            Log in to Connect
                          </button>
                        ) : myConnection === null ? (
                          <button className="btn btn-primary btn-block" onClick={() => void handleConnectOwner()} disabled={connectingOwner}>
                            {connectingOwner ? "Sending Request..." : "Connect Owner"}
                          </button>
                        ) : myConnection.status === "Pending" ? (
                          <div className="listing-details-connect-stack">
                            <div className="listing-details-status listing-details-status-pending">
                              Request Pending - awaiting owner response
                            </div>
                            <button
                              className="btn btn-outline btn-block"
                              onClick={() => void handleCancelRequest()}
                              disabled={cancellingRequest}
                            >
                              {cancellingRequest ? "Cancelling..." : "Cancel Request"}
                            </button>
                          </div>
                        ) : myConnection.status === "Rejected" ? (
                          <div className="listing-details-status listing-details-status-rejected">
                            Deal closed by owner
                          </div>
                        ) : (
                          <div className="listing-details-status listing-details-status-connected">
                            Connected - deal confirmed
                          </div>
                        )}
                      </div>
                    ) : null}

                    {!canEdit ? (
                      <button
                        className={`btn btn-outline btn-block listing-details-like-btn${isFavorited ? " is-active" : ""}`}
                        onClick={() => void handleToggleFavorite()}
                        disabled={favoriting}
                      >
                        <Heart size={16} fill={isFavorited ? "currentColor" : "none"} />
                        {favoriting ? "Updating..." : isFavorited ? "Liked" : "Like Property"}
                      </button>
                    ) : null}

                    <button className="btn btn-outline btn-block" onClick={() => navigate("/browse")}>
                      Back to Listings
                    </button>

                    {canEdit ? (
                      <button className="btn btn-dark btn-block listing-details-edit-btn" onClick={() => setIsEditing(true)}>
                        Edit Property
                      </button>
                    ) : null}
                  </div>
                </aside>
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <SiteFooter />

      {isEditing && item && editForm ? (
        <div className="listing-details-modal-overlay">
          <div className="surface-card listing-details-modal-card">
            <h2 className="listing-details-modal-title">Edit Property</h2>

            <div className="field-grid-2">
              <div className="field">
                <label>Monthly Rent</label>
                <input
                  className="input-style"
                  type="text"
                  inputMode="numeric"
                  value={editForm.monthlyRent}
                  onChange={(event) =>
                    setEditForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            monthlyRent: Number((event.target.value || "").replace(/\D/g, "") || "0"),
                          }
                        : prev,
                    )
                  }
                />
              </div>

              <div className="field">
                <label>Security Deposit</label>
                <input
                  className="input-style"
                  type="text"
                  inputMode="numeric"
                  value={editForm.securityDeposit}
                  onChange={(event) =>
                    setEditForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            securityDeposit: Number((event.target.value || "").replace(/\D/g, "") || "0"),
                          }
                        : prev,
                    )
                  }
                />
              </div>

              <div className="field">
                <label>Max Occupants</label>
                <input
                  className="input-style"
                  type="text"
                  inputMode="numeric"
                  value={editForm.maxOccupants}
                  onChange={(event) =>
                    setEditForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            maxOccupants: Math.min(
                              10,
                              Math.max(1, Number((event.target.value || "").replace(/\D/g, "") || "1")),
                            ),
                          }
                        : prev,
                    )
                  }
                />
              </div>

              <div className="field">
                <label>Available From</label>
                <input
                  className="input-style"
                  type="date"
                  value={editForm.availableFrom}
                  onChange={(event) =>
                    setEditForm((prev) => (prev ? { ...prev, availableFrom: event.target.value } : prev))
                  }
                />
              </div>

              <div className="field listing-details-field-fullwidth">
                <label>Description</label>
                <textarea
                  className="textarea-style"
                  value={editForm.description}
                  onChange={(event) =>
                    setEditForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                  }
                />
              </div>

              <div className="field listing-details-field-fullwidth">
                <label className="listing-details-checkbox-label">
                  <input
                    type="checkbox"
                    checked={editForm.allowSmoking}
                    onChange={(event) =>
                      setEditForm((prev) => (prev ? { ...prev, allowSmoking: event.target.checked } : prev))
                    }
                  />
                  Smoking Allowed
                </label>
              </div>

              <div className="field listing-details-field-fullwidth">
                <label>Exterior Image</label>
                <input
                  id="listing-details-exterior-upload"
                  className="listing-details-upload-input-hidden"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setEditExteriorFile(file);
                    if (file) {
                      setEditForm((prev) =>
                        prev ? { ...prev, exteriorPhotoUrl: URL.createObjectURL(file) } : prev,
                      );
                    }
                  }}
                />
                <label htmlFor="listing-details-exterior-upload" className="listing-details-upload-trigger">
                  <span className="listing-details-upload-trigger-title">
                    {editExteriorFile ? editExteriorFile.name : "Upload exterior image"}
                  </span>
                  <span className="listing-details-upload-trigger-hint">PNG, JPG, WEBP</span>
                </label>
              </div>

              <div className="field listing-details-field-fullwidth">
                <label>Room Images (max 2)</label>
                <div className="field-grid-2">
                  {[0, 1].map((index) => (
                    <div key={index} className="listing-details-room-upload-box">
                      <input
                        id={`listing-details-room-upload-${index}`}
                        className="listing-details-upload-input-hidden"
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          setEditRoomFiles((prev) => prev.map((value, i) => (i === index ? file : value)));
                          if (file) {
                            setEditForm((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    roomPhotoUrls: prev.roomPhotoUrls.map((url, i) =>
                                      i === index ? URL.createObjectURL(file) : url,
                                    ),
                                  }
                                : prev,
                            );
                          }
                        }}
                      />
                      <label
                        htmlFor={`listing-details-room-upload-${index}`}
                        className="listing-details-upload-trigger"
                      >
                        <span className="listing-details-upload-trigger-title">
                          {editRoomFiles[index] ? editRoomFiles[index]?.name : `Upload room image ${index + 1}`}
                        </span>
                        <span className="listing-details-upload-trigger-hint">PNG, JPG, WEBP</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="listing-details-modal-actions">
              <button className="btn btn-outline" onClick={() => setIsEditing(false)} disabled={isSavingEdit}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => void handleSaveEdit()} disabled={isSavingEdit}>
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

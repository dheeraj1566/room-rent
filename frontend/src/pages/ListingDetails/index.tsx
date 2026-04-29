import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BadgeIndianRupee,
  BedDouble,
  CalendarDays,
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
    <div style={{ display: "flex", gap: 4 }}>
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
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

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
  const [togglingFavorite, setTogglingFavorite] = useState(false);

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
      setSelectedPhoto(data.coverPhotoUrl || data.photos[0]?.photoUrl || null);

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
    if (user && user.id !== item.landlordId) {
      void loadConnectionStatus(item.listingId);
      apiFetch<{ ids: string[] }>("/api/favorites/ids", { method: "GET" })
        .then((data) => setIsFavorited(data.ids.includes(item.listingId)))
        .catch(() => {});
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

  const handleToggleFavorite = async () => {
    if (!item || !user) return;
    setTogglingFavorite(true);
    try {
      const data = await apiFetch<{ liked: boolean }>(`/api/favorites/${item.listingId}`, { method: "POST" });
      setIsFavorited(data.liked);
      showToast(data.liked ? "Added to liked properties" : "Removed from liked properties", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to update favorite", "error");
    } finally {
      setTogglingFavorite(false);
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
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div className="surface-card" style={{ padding: 18 }}>
                    <Skeleton style={{ width: "100%", aspectRatio: "1.6 / 1", borderRadius: 22 }} />
                    <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
                      {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} style={{ width: 92, height: 72, borderRadius: 16 }} />
                      ))}
                    </div>
                  </div>
                  <Skeleton style={{ height: 140, borderRadius: 24 }} />
                  <Skeleton style={{ height: 200, borderRadius: 24 }} />
                </div>
                <Skeleton style={{ height: 360, borderRadius: 24 }} />
              </div>
            ) : errorMsg ? (
              <div className="error-banner">{errorMsg}</div>
            ) : item ? (
              <div className="details-layout details-layout--loaded">
                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                  <section className="surface-card" style={{ padding: 18 }}>
                    <div
                      className="dot-grid"
                      style={{
                        borderRadius: 26,
                        overflow: "hidden",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div style={{ width: "100%", aspectRatio: "1.68 / 1", background: "var(--slate-100)" }}>
                        {selectedPhoto ? (
                          <img
                            src={selectedPhoto}
                            alt={item.title}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <div className="listing-card-placeholder">
                            <Home size={72} />
                            <span style={{ fontWeight: 700 }}>NO IMAGE YET</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {allPhotos.length > 0 ? (
                      <div style={{ display: "flex", gap: 12, marginTop: 14, overflowX: "auto", paddingBottom: 2 }}>
                        {allPhotos.map((photo, index) => (
                          <button
                            key={`${photo.photoType}-${photo.displayOrder}-${index}`}
                            onClick={() => setSelectedPhoto(photo.photoUrl)}
                            style={{
                              width: 98,
                              minWidth: 98,
                              height: 76,
                              borderRadius: 18,
                              overflow: "hidden",
                              padding: 0,
                              border:
                                selectedPhoto === photo.photoUrl
                                  ? "2px solid var(--orange-500)"
                                  : "1px solid var(--border-color)",
                              boxShadow:
                                selectedPhoto === photo.photoUrl
                                  ? "0 8px 18px rgba(255,154,61,0.18)"
                                  : "none",
                              background: "white",
                              cursor: "pointer",
                            }}
                          >
                            <img
                              src={photo.photoUrl}
                              alt={`${photo.photoType} ${photo.displayOrder}`}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </section>

                  <section className="surface-card" style={{ padding: 28 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
                      <div>
                        <span className="badge badge-soft" style={{ marginBottom: 14 }}>
                          <Clock3 size={14} />
                          Added {formatDisplayDate(item.createdAt)}
                        </span>
                        <h1 style={{ fontSize: "2.15rem", lineHeight: 1.1, marginBottom: 10 }}>{item.title}</h1>
                        <p style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

                    <div className="listing-card-meta" style={{ marginBottom: item.description ? 16 : 0 }}>
                      <span className="listing-card-meta-item">
                        <BadgeIndianRupee size={16} />
                        ₹{item.monthlyRent.toLocaleString("en-IN")}/month
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
                      <div style={{ paddingTop: 18, borderTop: "1px solid var(--slate-200)" }}>
                        <h2 style={{ fontSize: "1.35rem", marginBottom: 10 }}>About this property</h2>
                        <p>{item.description}</p>
                      </div>
                    ) : null}
                  </section>

                  <section className="surface-card" style={{ padding: 28 }}>
                    <h2 style={{ fontSize: "1.35rem", marginBottom: 16 }}>Property Details</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
                      {detailItems.map((detail) => (
                        <div
                          key={detail.label}
                          style={{
                            border: "1px solid var(--slate-200)",
                            background: "var(--slate-100)",
                            borderRadius: 18,
                            padding: "14px 16px",
                          }}
                        >
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.82rem", fontWeight: 800, color: "var(--slate-700)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                            {detail.icon}
                            {detail.label}
                          </div>
                          <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--navy-900)" }}>{detail.value}</div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="surface-card" style={{ padding: 28 }}>
                    <h2 style={{ fontSize: "1.35rem", marginBottom: 16 }}>Location</h2>
                    <div style={{ borderRadius: 24, overflow: "hidden", border: "1px solid var(--slate-200)" }}>
                      <iframe
                        title="Property location"
                        src={mapUrl}
                        style={{ width: "100%", height: "clamp(240px, 52vw, 420px)", border: 0 }}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  </section>

                  <section className="surface-card" style={{ padding: 28 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                      <div>
                        <h2 style={{ fontSize: "1.35rem", marginBottom: 4 }}>Landlord Reviews</h2>
                        <p>
                          {avgRating ? `${avgRating.toFixed(1)} ★` : "No rating yet"} · {testimonials.length} review{testimonials.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      {avgRating ? <ReviewStars value={Math.round(avgRating)} /> : null}
                    </div>

                    {testimonialsLoading ? (
                      <Skeleton style={{ height: 140, borderRadius: 18 }} />
                    ) : testimonials.length === 0 ? (
                      <div
                        style={{
                          borderRadius: 22,
                          background: "var(--slate-100)",
                          padding: 24,
                          textAlign: "center",
                        }}
                      >
                        <p>No reviews yet.</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {testimonials.map((testimonial) => (
                          <div
                            key={testimonial.testimonialId}
                            style={{
                              border: "1px solid var(--slate-200)",
                              background: "white",
                              borderRadius: 20,
                              padding: 18,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                              <div
                                style={{
                                  width: 42,
                                  height: 42,
                                  borderRadius: "50%",
                                  overflow: "hidden",
                                  background: "linear-gradient(180deg, #fff2e2 0%, #f6f7fb 100%)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 800,
                                  color: "var(--navy-800)",
                                }}
                              >
                                {testimonial.reviewerPhoto ? (
                                  <img
                                    src={testimonial.reviewerPhoto}
                                    alt={testimonial.reviewerName}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                ) : (
                                  testimonial.reviewerName.charAt(0).toUpperCase()
                                )}
                              </div>

                              <div>
                                <div style={{ fontWeight: 700, color: "var(--navy-900)" }}>{testimonial.reviewerName}</div>
                                <div style={{ fontSize: "0.84rem", color: "var(--slate-600)" }}>
                                  {testimonial.reviewerRole} · {formatDisplayDate(testimonial.createdAt)}
                                </div>
                              </div>

                              <div style={{ marginLeft: "auto" }}>
                                <ReviewStars value={testimonial.rating} size={14} />
                              </div>
                            </div>

                            <p>{testimonial.body}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {!user ? (
                      <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--slate-200)" }}>
                        <p>
                          <a href="/login" className="link-accent">Log in</a> to write a review.
                        </p>
                      </div>
                    ) : user.id === item.landlordId ? (
                      <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--slate-200)" }}>
                        <p>You cannot review your own listing.</p>
                      </div>
                    ) : !myConnection?.isConnected ? (
                      <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--slate-200)" }}>
                        <p>Connect with the owner and get your deal confirmed to leave a review.</p>
                      </div>
                    ) : (
                      <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--slate-200)" }}>
                        <h3 style={{ fontSize: "1.05rem", marginBottom: 10 }}>{myReview ? "Edit Your Review" : "Write a Review"}</h3>
                        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onMouseEnter={() => setReviewHover(star)}
                              onMouseLeave={() => setReviewHover(0)}
                              onClick={() => setReviewRating(star)}
                              style={{ background: "transparent", cursor: "pointer", padding: 2 }}
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
                          className="btn btn-primary"
                          style={{ marginTop: 14 }}
                          onClick={() => void handleSubmitReview()}
                          disabled={submittingReview || reviewBody.trim().length === 0}
                        >
                          {submittingReview ? "Submitting..." : myReview ? "Update Review" : "Submit Review"}
                        </button>
                      </div>
                    )}
                  </section>
                </div>

                <aside style={{ position: "sticky", top: 104 }}>
                  <div className="surface-card" style={{ padding: 24 }}>
                    <div style={{ paddingBottom: 18, borderBottom: "1px solid var(--slate-200)", marginBottom: 18 }}>
                      <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--navy-950)", lineHeight: 1 }}>
                        ₹{Number(item.monthlyRent).toLocaleString("en-IN")}
                        <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--slate-600)" }}>/month</span>
                      </div>
                      <p style={{ marginTop: 8 }}>
                        For {item.maxOccupants} occupant{item.maxOccupants > 1 ? "s" : ""}
                      </p>

                      {Array.isArray(item.rentTiers) && item.rentTiers.length > 0 ? (
                        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                          {[...item.rentTiers]
                            .sort((a, b) => b.occupants - a.occupants)
                            .map((tier) => (
                              <div key={tier.occupants} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                                <span>{tier.occupants} occupant{tier.occupants > 1 ? "s" : ""}</span>
                                <strong>₹{Number(tier.rent).toLocaleString("en-IN")}</strong>
                              </div>
                            ))}
                        </div>
                      ) : null}

                      {item.securityDeposit && item.securityDeposit > 0 ? (
                        <p style={{ marginTop: 12 }}>
                          Security Deposit: ₹{Number(item.securityDeposit).toLocaleString("en-IN")}
                        </p>
                      ) : null}
                    </div>

                    <div
                      style={{
                        borderRadius: 20,
                        background: "var(--slate-100)",
                        border: "1px solid var(--slate-200)",
                        padding: 16,
                        marginBottom: 18,
                      }}
                    >
                      <div style={{ fontSize: "0.84rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--slate-700)", marginBottom: 8 }}>
                        Property Owner
                      </div>
                      <div style={{ fontSize: "1.12rem", fontWeight: 700, color: "var(--navy-900)" }}>{item.landlordName}</div>
                    </div>

                    {!canEdit ? (
                      <div style={{ marginBottom: 14 }}>
                        {!user ? (
                          <button className="btn btn-primary btn-block" onClick={() => navigate("/login")}>
                            Log in to Connect
                          </button>
                        ) : myConnection === null ? (
                          <button className="btn btn-primary btn-block" onClick={() => void handleConnectOwner()} disabled={connectingOwner}>
                            {connectingOwner ? "Sending Request..." : "Connect Owner"}
                          </button>
                        ) : myConnection.status === "Pending" ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <div
                              style={{
                                padding: "12px 14px",
                                borderRadius: 16,
                                background: "#fff7e8",
                                border: "1px solid rgba(255,154,61,0.45)",
                                color: "#b96817",
                                fontWeight: 700,
                                fontSize: "0.88rem",
                              }}
                            >
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
                          <div
                            style={{
                              padding: "12px 14px",
                              borderRadius: 16,
                              background: "rgba(255,95,87,0.08)",
                              border: "1px solid rgba(255,95,87,0.25)",
                              color: "#b3403a",
                              fontWeight: 700,
                              fontSize: "0.88rem",
                            }}
                          >
                            Deal closed by owner
                          </div>
                        ) : (
                          <div
                            style={{
                              padding: "12px 14px",
                              borderRadius: 16,
                              background: "var(--green-100)",
                              border: "1px solid rgba(24,169,87,0.25)",
                              color: "var(--green-500)",
                              fontWeight: 700,
                              fontSize: "0.88rem",
                            }}
                          >
                            Connected - deal confirmed
                          </div>
                        )}
                      </div>
                    ) : null}

                    {!canEdit && user ? (
                      <button
                        className={`btn btn-outline btn-block${isFavorited ? " active" : ""}`}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}
                        onClick={() => void handleToggleFavorite()}
                        disabled={togglingFavorite}
                        aria-label={isFavorited ? "Remove from favorites" : "Save to favorites"}
                      >
                        <Heart size={16} fill={isFavorited ? "currentColor" : "none"} style={{ color: isFavorited ? "var(--red-500)" : undefined }} />
                        {isFavorited ? "Saved" : "Save Property"}
                      </button>
                    ) : null}

                    <button className="btn btn-outline btn-block" onClick={() => navigate("/browse")}>
                      Back to Listings
                    </button>

                    {canEdit ? (
                      <button className="btn btn-dark btn-block" style={{ marginTop: 12 }} onClick={() => setIsEditing(true)}>
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
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 40, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 100,
          }}
        >
          <div
            className="surface-card"
            style={{
              width: "min(760px, 100%)",
              maxHeight: "calc(100vh - 32px)",
              overflowY: "auto",
              padding: 26,
            }}
          >
            <h2 style={{ fontSize: "1.45rem", marginBottom: 16 }}>Edit Property</h2>

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

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Description</label>
                <textarea
                  className="textarea-style"
                  value={editForm.description}
                  onChange={(event) =>
                    setEditForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                  }
                />
              </div>

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
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

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Exterior Image</label>
                <input
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
              </div>

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Room Images (max 2)</label>
                <div className="field-grid-2">
                  {[0, 1].map((index) => (
                    <div key={index} style={{ border: "1px solid var(--slate-200)", borderRadius: 16, padding: 14 }}>
                      <input
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
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 18 }}>
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

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import Navbar from "../../components/Navbar";
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
  foodPreferenceName: string;
  monthlyRent: number;
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
  updatedAt: string;
  propertyTypeId: number | null;
  foodLevelId: number | null;
  bedType: string | null;
  singleBedCount: number | null;
  doubleBedCount: number | null;
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

const propertyTypeMap: Record<number, string> = {
  1: "PG",
  2: "Individual",
  3: "Flat",
};

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
      setSelectedPhoto(data.coverPhotoUrl || (data.photos[0]?.photoUrl ?? null));
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
  }, [listingId, logout, navigate]);

  const mapUrl = useMemo(() => {
    if (!item) return "";
    return `https://maps.google.com/maps?q=${item.latitude},${item.longitude}&z=15&output=embed`;
  }, [item]);
  const canEdit = Boolean(user && item && user.id === item.landlordId);

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
          roomPhotoUrls: editForm.roomPhotoUrls.map((url, idx) => (editRoomFiles[idx] ? "" : url.trim())),
        })
      );
      if (editExteriorFile) {
        formData.append("exteriorFile", editExteriorFile);
      }
      editRoomFiles.forEach((file, idx) => {
        if (file) formData.append(`roomFile-${idx}`, file);
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

  return (
    <>
      <Navbar />
      <div style={{ width: '100%', padding: '1.5rem' }}>
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '1.5rem', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <Skeleton style={{ width: '100%', aspectRatio: '16 / 9' }} />
                <div style={{ padding: '1rem', display: 'flex', gap: '0.75rem' }}>
                  <Skeleton style={{ width: 120, height: 90 }} />
                  <Skeleton style={{ width: 120, height: 90 }} />
                  <Skeleton style={{ width: 120, height: 90 }} />
                </div>
              </div>
              <div className="glass-card">
                <Skeleton style={{ width: '45%', height: 32, marginBottom: '1rem' }} />
                <Skeleton style={{ width: '80%', height: 18, marginBottom: '0.5rem' }} />
                <Skeleton style={{ width: '65%', height: 18 }} />
              </div>
              <div className="glass-card">
                <Skeleton style={{ width: '35%', height: 26, marginBottom: '1rem' }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
                  {Array.from({ length: 9 }).map((_, idx) => (
                    <Skeleton key={`detail-item-skeleton-${idx}`} style={{ width: '100%', height: 44 }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="glass-card">
              <Skeleton style={{ width: '55%', height: 40, marginBottom: '1rem' }} />
              <Skeleton style={{ width: '80%', height: 18, marginBottom: '1rem' }} />
              <Skeleton style={{ width: '100%', height: 46, marginBottom: '0.75rem' }} />
              <Skeleton style={{ width: '100%', height: 46 }} />
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="glass-card text-center" style={{ color: "#ef4444" }}>
            <p style={{ margin: 0 }}>{errorMsg}</p>
          </div>
        )}

        {!loading && !errorMsg && item && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '1.5rem', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Photo Gallery */}
              <section className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                {selectedPhoto ? (
                  <div style={{ width: '100%', aspectRatio: '16 / 9', background: 'var(--hover-bg)' }}>
                    <img
                      src={selectedPhoto}
                      alt={item.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ) : (
                  <div style={{ width: '100%', aspectRatio: '16 / 9', background: 'var(--hover-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-light)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 0.5rem' }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <p style={{ margin: 0 }}>No photos available</p>
                    </div>
                  </div>
                )}

                {item.photos.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem', overflowX: 'auto', background: 'var(--bg-color)' }}>
                    {item.photos.map((photo, index) => (
                      <div
                        key={`${photo.photoType}-${photo.displayOrder}-${index}`}
                        style={{
                          width: '120px',
                          height: '90px',
                          flexShrink: 0,
                          borderRadius: '6px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: selectedPhoto === photo.photoUrl ? '3px solid var(--brand-primary)' : '2px solid var(--border-color)',
                          transition: 'all 0.2s ease'
                        }}
                        onClick={() => setSelectedPhoto(photo.photoUrl)}
                      >
                        <img
                          src={photo.photoUrl}
                          alt={`${photo.photoType} ${photo.displayOrder}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Property Details */}
              <section className="glass-card">
                <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  <h1 style={{ fontSize: '1.75rem', marginBottom: '0.75rem', fontWeight: 700 }}>{item.title}</h1>
                  <p style={{ fontSize: '1rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    {item.addressLine}, {item.colony}, {item.city}, {item.state} - {item.pincode}
                  </p>
                </div>

                {item.description && (
                  <div>
                    <h3 style={{ fontSize: '1.125rem', marginBottom: '0.75rem', fontWeight: 600 }}>About this property</h3>
                    <p style={{ lineHeight: '1.7', color: 'var(--text-muted)' }}>{item.description}</p>
                  </div>
                )}
              </section>

              {/* Property Features */}
              <section className="glass-card">
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 600 }}>Property Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
                  <div className="detail-item">
                    <span className="detail-label">Property Type</span>
                    <span className="detail-value">
                      {item.propertyTypeId ? propertyTypeMap[item.propertyTypeId] || 'N/A' : 'N/A'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Floor</span>
                    <span className="detail-value">{item.floorName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Furnishing</span>
                    <span className="detail-value">{item.furnishingName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Max Occupants</span>
                    <span className="detail-value">{item.maxOccupants} {item.maxOccupants === 1 ? 'Person' : 'People'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Food Preference</span>
                    <span className="detail-value">{item.foodPreferenceName}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Smoking</span>
                    <span className="detail-value">{item.allowSmoking ? 'Allowed' : 'Not Allowed'}</span>
                  </div>
                  {item.bedType && (
                    <div className="detail-item">
                      <span className="detail-label">Bed Type</span>
                      <span className="detail-value">{item.bedType}</span>
                    </div>
                  )}
                  {item.singleBedCount !== null && item.singleBedCount > 0 && (
                    <div className="detail-item">
                      <span className="detail-label">Single Beds</span>
                      <span className="detail-value">{item.singleBedCount}</span>
                    </div>
                  )}
                  {item.doubleBedCount !== null && item.doubleBedCount > 0 && (
                    <div className="detail-item">
                      <span className="detail-label">Double Beds</span>
                      <span className="detail-value">{item.doubleBedCount}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">Available From</span>
                    <span className="detail-value">{new Date(item.availableFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
              </section>

              {/* Map */}
              <section className="glass-card">
                <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>Location</h3>
                <iframe
                  title="Property Location"
                  src={mapUrl}
                  loading="lazy"
                  style={{ width: "100%", height: "400px", border: 0, borderRadius: "6px" }}
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </section>
            </div>

            {/* Sidebar */}
            <div style={{ position: 'sticky', top: '5rem' }}>
              <div className="glass-card" style={{ boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '2.25rem', fontWeight: 700, color: 'var(--brand-primary)', marginBottom: '0.25rem' }}>
                    ₹{Number(item.monthlyRent).toLocaleString('en-IN')}
                    <span style={{ fontSize: '1.125rem', fontWeight: 500, color: 'var(--text-muted)' }}>/month</span>
                  </div>
                  {item.securityDeposit && item.securityDeposit > 0 && (
                    <p style={{ fontSize: '0.9375rem', margin: 0, color: 'var(--text-muted)' }}>
                      Security Deposit: ₹{Number(item.securityDeposit).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>

                <div style={{ padding: '1.25rem', background: 'var(--hover-bg)', borderRadius: '6px', marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                    Property Owner
                  </p>
                  <p style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'var(--brand-primary)' }}>
                    {item.landlordName}
                  </p>
                </div>

                <button
                  className="btn btn-primary w-full"
                  style={{ marginBottom: '0.75rem', padding: '0.875rem' }}
                  onClick={() => alert('Contact feature coming soon!')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  Contact Owner
                </button>

                <button
                  className="btn btn-outline w-full"
                  onClick={() => navigate('/listings')}
                >
                  Back to Listings
                </button>
                {canEdit && (
                  <button
                    className="btn btn-primary w-full"
                    style={{ marginTop: '0.75rem' }}
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Property
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {isEditing && item && editForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 999,
          }}
        >
          <div
            className="glass-card"
            style={{
              width: "100%",
              maxWidth: "720px",
              maxHeight: "calc(100vh - 2rem)",
              overflowY: "auto",
            }}
          >
            <h3 style={{ marginBottom: "1rem" }}>Edit Property</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label>Monthly Rent</label>
                <input
                  className="input-style"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={editForm.monthlyRent}
                  onChange={(e) =>
                    setEditForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            monthlyRent: Number((e.target.value || "").replace(/\D/g, "") || "0"),
                          }
                        : prev
                    )
                  }
                />
              </div>
              <div className="form-group">
                <label>Security Deposit</label>
                <input
                  className="input-style"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={editForm.securityDeposit}
                  onChange={(e) =>
                    setEditForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            securityDeposit: Number((e.target.value || "").replace(/\D/g, "") || "0"),
                          }
                        : prev
                    )
                  }
                />
              </div>
              <div className="form-group">
                <label>Max Occupants</label>
                <input
                  className="input-style"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={editForm.maxOccupants}
                  onChange={(e) =>
                    setEditForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            maxOccupants: Math.min(
                              10,
                              Math.max(1, Number((e.target.value || "").replace(/\D/g, "") || "1"))
                            ),
                          }
                        : prev
                    )
                  }
                />
              </div>
              <div className="form-group">
                <label>Available From</label>
                <input
                  className="input-style"
                  type="date"
                  value={editForm.availableFrom}
                  onChange={(e) =>
                    setEditForm((prev) => (prev ? { ...prev, availableFrom: e.target.value } : prev))
                  }
                />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Description</label>
                <textarea
                  className="input-style"
                  rows={4}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => (prev ? { ...prev, description: e.target.value } : prev))
                  }
                />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="checkbox-group">
                  <input
                    type="checkbox"
                    checked={editForm.allowSmoking}
                    onChange={(e) =>
                      setEditForm((prev) => (prev ? { ...prev, allowSmoking: e.target.checked } : prev))
                    }
                  />
                  Smoking Allowed
                </label>
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Exterior Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setEditExteriorFile(file);
                    if (file) {
                      setEditForm((prev) =>
                        prev ? { ...prev, exteriorPhotoUrl: URL.createObjectURL(file) } : prev
                      );
                    }
                  }}
                />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Room Images (max 2)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  {[0, 1].map((idx) => (
                    <div key={`edit-room-image-${idx}`} style={{ border: "1px solid var(--border-color)", borderRadius: 8, padding: "0.75rem" }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setEditRoomFiles((prev) => prev.map((value, i) => (i === idx ? file : value)));
                          if (file) {
                            setEditForm((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    roomPhotoUrls: prev.roomPhotoUrls.map((url, i) =>
                                      i === idx ? URL.createObjectURL(file) : url
                                    ),
                                  }
                                : prev
                            );
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button className="btn btn-outline" onClick={() => setIsEditing(false)} disabled={isSavingEdit}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => void handleSaveEdit()} disabled={isSavingEdit}>
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

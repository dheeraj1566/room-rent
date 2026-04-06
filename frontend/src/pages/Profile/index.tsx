import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";

type Profile = {
  id: string;
  fullName: string | null;
  email: string | null;
  location: string | null;
  aadhaar: string | null;
  phone: string | null;
  photo: string | null;
};

type ProfilePayload = {
  fullName: string;
  email: string;
  location: string;
  aadhaar: string;
  phone: string;
  photo: string;
};

const emptyPayload: ProfilePayload = {
  fullName: "",
  email: "",
  location: "",
  aadhaar: "",
  phone: "",
  photo: "",
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [form, setForm] = useState<ProfilePayload>(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadProfile = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await apiFetch<{ profile: Profile }>("/api/auth/profile", {
        method: "GET",
      });

      const nextProfile = data.profile;
      setForm({
        fullName: nextProfile.fullName || "",
        email: nextProfile.email || "",
        location: nextProfile.location || "",
        aadhaar: nextProfile.aadhaar || "",
        phone: nextProfile.phone || "",
        photo: nextProfile.photo || "",
      });
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }
      setErrorMsg(error instanceof Error ? error.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const handleSave = async () => {
    const trimmedAadhaar = form.aadhaar.trim();
    if (trimmedAadhaar && !/^\d{12}$/.test(trimmedAadhaar)) {
      setErrorMsg("Aadhaar must be exactly 12 digits");
      setSuccessMsg("");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const data = await apiFetch<{ message: string; profile: Profile }>("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setSuccessMsg(data.message);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        await logout();
        navigate("/login", { replace: true });
        return;
      }
      setErrorMsg(error instanceof Error ? error.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const data = await apiFetch<{ url: string }>("/api/uploads/image", {
        method: "POST",
        body: formData,
      });
      setForm((prev) => ({ ...prev, photo: data.url }));
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg("Geolocation is not supported by your browser");
      return;
    }

    setLocating(true);
    setErrorMsg("");
    setSuccessMsg("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
              lat
            )}&lon=${encodeURIComponent(lng)}`
          );

          if (!response.ok) {
            throw new Error("Reverse geocoding failed");
          }

          const body = (await response.json()) as { display_name?: string };
          const exactAddress = body.display_name?.trim();
          setForm((prev) => ({
            ...prev,
            location: exactAddress && exactAddress.length ? exactAddress : `${lat}, ${lng}`,
          }));
        } catch {
          setForm((prev) => ({ ...prev, location: `${lat}, ${lng}` }));
        } finally {
          setLocating(false);
        }
      },
      () => {
        setErrorMsg("Unable to fetch current location. Check browser permission.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const avatarFallback = (form.fullName || form.email || "U").trim().charAt(0).toUpperCase();

  if (loading) {
    return <div className="text-center mt-4">Loading profile...</div>;
  }

  return (
    <>
      <Navbar />
      <div className="profile-container">
        <div className="glass-card" style={{ marginBottom: "1.5rem" }}>
          <div className="flex-row justify-between">
            <div>
              <h2 style={{ marginBottom: "0.25rem", fontSize: '1.75rem' }}>My Profile</h2>
              <p style={{ margin: 0 }}>Manage your account information and preferences</p>
            </div>
          </div>
        </div>

      {errorMsg && (
        <div className="glass-card text-center" style={{ color: "#ef4444", marginBottom: "1rem" }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="glass-card text-center" style={{ color: "#10b981", marginBottom: "1rem" }}>
          {successMsg}
        </div>
      )}

      <div className="glass-card">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "240px 1fr",
            gap: "2rem",
            alignItems: "start",
          }}
        >
          <div className="flex-col" style={{ alignItems: "center" }}>
            <div className="profile-avatar">
              {form.photo.trim() ? (
                <img
                  src={form.photo}
                  alt="Profile"
                />
              ) : (
                avatarFallback
              )}
            </div>
            <label className="btn btn-outline" style={{ cursor: "pointer", marginTop: "1rem", width: '100%' }}>
              {uploading ? "Uploading..." : "Change Photo"}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void handlePhotoUpload(e)}
                style={{ display: "none" }}
                disabled={uploading}
              />
            </label>
          </div>

          <div className="flex-col">
            <div className="form-group">
              <label>Photo URL</label>
              <input
                type="url"
                className="input-style"
                value={form.photo}
                onChange={(e) => setForm((prev) => ({ ...prev, photo: e.target.value }))}
                placeholder="https://example.com/my-photo.jpg"
              />
            </div>

            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                className="input-style"
                value={form.fullName}
                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                placeholder="Your full name"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                className="input-style"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="you@example.com"
              />
            </div>

            <div className="form-group">
              <label>Location</label>
              <div className="flex-row" style={{ alignItems: "stretch" }}>
                <input
                  type="text"
                  className="input-style"
                  value={form.location}
                  onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                  placeholder="City / Area"
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {locating ? "Locating..." : "Use current location"}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Aadhaar</label>
              <input
                type="text"
                className="input-style"
                value={form.aadhaar}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    aadhaar: e.target.value.replace(/\D/g, "").slice(0, 12),
                  }))
                }
                placeholder="12-digit Aadhaar number"
                inputMode="numeric"
                maxLength={12}
              />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                className="input-style"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone number"
              />
            </div>

            <div className="flex-row" style={{ justifyContent: "space-between" }}>
              <div className="flex-row">
                <button
                  className="btn btn-primary"
                  onClick={() => void handleSave()}
                  disabled={saving || uploading}
                >
                  {saving ? "Updating..." : "Update Profile"}
                </button>
              </div>
              <button className="btn btn-outline" onClick={() => void loadProfile()}>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import Navbar from "../../components/Navbar";
import Skeleton from "../../components/Skeleton";

type Profile = {
  id: string;
  fullName: string | null;
  email: string | null;
  location: string | null;
  aadhaar: string | null;
  phone: string | null;
  photo: string | null;
  gender: "Male" | "Female" | null;
};

type ProfilePayload = {
  fullName: string;
  email: string;
  location: string;
  aadhaar: string;
  phone: string;
  photo: string;
  gender: "Male" | "Female" | "";
};

const emptyPayload: ProfilePayload = {
  fullName: "",
  email: "",
  location: "",
  aadhaar: "",
  phone: "",
  photo: "",
  gender: "",
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState<ProfilePayload>(emptyPayload);
  const [aadhaarLocked, setAadhaarLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loadProfile = useCallback(async () => {
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
        gender: nextProfile.gender || "",
      });
      setAadhaarLocked(Boolean((nextProfile.aadhaar || "").trim()));
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
  }, [logout, navigate]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);


  const handleSave = async () => {
    const trimmedAadhaar = form.aadhaar.trim();
    const trimmedPhone = form.phone.trim();
    if (trimmedAadhaar && !/^\d{12}$/.test(trimmedAadhaar)) {
      setErrorMsg("Aadhaar must be exactly 12 digits");
      return;
    }
    if (trimmedPhone && !/^\d{10}$/.test(trimmedPhone)) {
      setErrorMsg("Phone number must be exactly 10 digits");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    try {
      const data = await apiFetch<{ message: string; profile: Profile }>("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      if ((data.profile?.aadhaar || "").trim()) {
        setAadhaarLocked(true);
      }
      showToast(data.message || "Profile updated successfully", "success");
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
    try {
      const formData = new FormData();
      formData.append("image", file);
      const data = await apiFetch<{ url: string }>("/api/uploads/image", {
        method: "POST",
        body: formData,
      });
      setForm((prev) => ({ ...prev, photo: data.url }));
      showToast("Photo uploaded successfully", "success");
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const avatarFallback = (form.fullName || form.email || "U").trim().charAt(0).toUpperCase();

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="profile-container profile-page">
          <div className="glass-card profile-header-card">
            <div style={{ width: "100%" }}>
              <Skeleton style={{ width: 140, height: 14, marginBottom: 10 }} />
              <Skeleton style={{ width: 220, height: 28, marginBottom: 8 }} />
              <Skeleton style={{ width: "60%", height: 16 }} />
            </div>
          </div>
          <div className="glass-card profile-main-card">
            <div className="profile-main-grid">
              <div className="flex-col" style={{ alignItems: "center" }}>
                <Skeleton style={{ width: 160, height: 160, borderRadius: "50%" }} />
                <Skeleton style={{ width: "100%", height: 40, marginTop: "1rem" }} />
              </div>
              <div className="profile-form-grid">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <Skeleton key={`profile-field-skeleton-${idx}`} style={{ width: "100%", height: 44 }} />
                ))}
                <Skeleton style={{ gridColumn: "1 / -1", width: "100%", height: 220 }} />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="profile-container profile-page">
        <div className="glass-card profile-header-card">
          <div>
            <p className="profile-eyebrow">Account Center</p>
            <h2 style={{ marginBottom: "0.25rem", fontSize: "1.75rem" }}>My Profile</h2>
            <p style={{ margin: 0 }}>Manage identity, contact details, and preferences.</p>
          </div>
          <div className="profile-status-chips">
            <span className="badge badge-info">Verified Rental Profile</span>
            {form.gender && <span className="badge badge-primary">{form.gender}</span>}
          </div>
        </div>

      {errorMsg && (
        <div className="glass-card text-center" style={{ color: "#ef4444", marginBottom: "1rem" }}>
          {errorMsg}
        </div>
      )}
      <div className="glass-card profile-main-card">
        <div className="profile-main-grid">
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

          <div className="profile-form-grid">
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
                readOnly
                disabled
                placeholder="you@example.com"
              />
            </div>

            <div className="form-group">
              <label>Gender</label>
              <select
                className="input-style"
                value={form.gender}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    gender: e.target.value as "Male" | "Female" | "",
                  }))
                }
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
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
                placeholder={aadhaarLocked ? "Aadhaar locked after verification" : "12-digit Aadhaar number"}
                inputMode="numeric"
                maxLength={12}
                disabled={aadhaarLocked}
              />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                className="input-style"
                value={form.phone}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                  }))
                }
                placeholder="Phone number"
                inputMode="numeric"
                maxLength={10}
              />
            </div>

            <div
              className="flex-row"
              style={{ justifyContent: "space-between", gridColumn: "1 / -1", marginTop: "0.5rem" }}
            >
              <div className="flex-row">
                <button
                  className="btn btn-primary"
                  onClick={() => void handleSave()}
                  disabled={saving || uploading}
                >
                  {saving ? "Updating..." : "Update Profile"}
                </button>
              </div>
           
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

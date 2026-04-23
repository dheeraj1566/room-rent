import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Heart, Home, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import SiteFooter from "../../components/SiteFooter";
import { ApiError, apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import Skeleton from "../../components/Skeleton";
import Select from "../../components/Select";

type Profile = {
  fullName: string | null;
  email: string | null;
  location: string | null;
  aadhaar: string | null;
  phone: string | null;
  photo: string | null;
  gender: "Male" | "Female" | "Other" | null;
};

type ProfilePayload = {
  fullName: string;
  email: string;
  location: string;
  aadhaar: string;
  phone: string;
  photo: string;
  gender: "Male" | "Female" | "Other" | "";
};

type FavoriteItem = {
  listingId: string;
  title: string;
  coverPhotoUrl: string | null;
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

const GENDER_OPTIONS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { logout, refreshSession } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState<ProfilePayload>(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isAadhaarLocked, setIsAadhaarLocked] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const initialForm = useRef<ProfilePayload>(emptyPayload);
  const favoritePreview = favorites.slice(0, 3);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await apiFetch<{ profile: Profile }>("/api/auth/profile", { method: "GET" });
      const nextPayload: ProfilePayload = {
        fullName: data.profile.fullName || "",
        email: data.profile.email || "",
        location: data.profile.location || "",
        aadhaar: data.profile.aadhaar || "",
        phone: data.profile.phone || "",
        photo: data.profile.photo || "",
        gender: data.profile.gender || "",
      };
      setForm(nextPayload);
      initialForm.current = nextPayload;
      setIsAadhaarLocked(Boolean(nextPayload.aadhaar));
    } catch (error) {
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
    apiFetch<{ items: FavoriteItem[] }>("/api/favorites", { method: "GET" })
      .then((data) => setFavorites(Array.isArray(data.items) ? data.items : []))
      .catch(() => setFavorites([]))
      .finally(() => setFavoritesLoading(false));
  }, [loadProfile]);

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg("");
    try {
      const changedFields: Partial<ProfilePayload> = {};
      (Object.keys(form) as (keyof ProfilePayload)[]).forEach((key) => {
        if (key === "aadhaar" && isAadhaarLocked) return;
        if (form[key] !== initialForm.current[key]) {
          (changedFields as Record<keyof ProfilePayload, ProfilePayload[keyof ProfilePayload]>)[key] = form[key];
        }
      });

      if (Object.keys(changedFields).length === 0) {
        showToast("No profile changes to save", "info");
        return;
      }

      await apiFetch("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(changedFields),
      });
      initialForm.current = { ...initialForm.current, ...changedFields };
      if (typeof changedFields.aadhaar === "string" && changedFields.aadhaar.length === 12) {
        setIsAadhaarLocked(true);
      }
      await refreshSession();
      showToast("Profile updated", "success");
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const uploaded = await apiFetch<{ url: string }>("/api/uploads/image", {
        method: "POST",
        body: formData,
      });
      setForm((prev) => ({ ...prev, photo: uploaded.url }));
      showToast("Photo uploaded", "success");
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Failed to upload photo");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const avatarFallback = (form.fullName || form.email || "A").trim().charAt(0).toUpperCase();

  return (
    <div className="app-shell">
      <Navbar />

      <main className="page-shell">
        <section className="page-section">
          <div className="page-container">
            <div className="profile-hero">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "start" }}>
                <div>
                  <p className="eyebrow" style={{ marginBottom: 12 }}>Account Center</p>
                  <h1 style={{ fontSize: "3rem", lineHeight: 1.05, marginBottom: 10 }}>My Profile</h1>
                  <p>Manage identity, contact details, and preferences.</p>
                </div>
                <span className="badge badge-verified">
                  <ShieldCheck size={16} />
                  Verified Rental Profile
                </span>
              </div>
            </div>

            {loading ? (
              <div className="surface-card profile-form-card">
                <Skeleton style={{ height: 380, borderRadius: 24 }} />
              </div>
            ) : (
              <>
                {errorMsg ? <div className="error-banner">{errorMsg}</div> : null}

                <div className="surface-card profile-form-card">
                  <div className="profile-form-layout">
                    <div className="avatar-block">
                      <div className="avatar-circle">
                        {form.photo ? <img src={form.photo} alt="Profile" /> : avatarFallback}
                      </div>
                      <label className="avatar-upload">
                        <Camera size={18} />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => void handlePhotoUpload(event)}
                          style={{ display: "none" }}
                          disabled={uploading}
                        />
                      </label>
                      <button className="btn btn-ghost" type="button">
                        {uploading ? "Uploading..." : "Change Photo"}
                      </button>
                    </div>

                    <div>
                      <div className="field-grid-2">
                        <div className="field">
                          <label>Full Name</label>
                          <input
                            className="input-style"
                            value={form.fullName}
                            onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                          />
                        </div>
                        <div className="field">
                          <label>Email</label>
                          <input
                            className="input-style"
                            value={form.email}
                            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                          />
                        </div>
                        <div className="field">
                          <label>Gender</label>
                          <Select
                            value={form.gender}
                            onChange={(next) =>
                              setForm((prev) => ({
                                ...prev,
                                gender: next as ProfilePayload["gender"],
                              }))
                            }
                            options={GENDER_OPTIONS}
                            placeholder="Select gender"
                            aria-label="Select gender"
                          />
                        </div>
                        <div className="field">
                          <label>Aadhaar</label>
                          <input
                            className="input-style"
                            value={form.aadhaar ? form.aadhaar.replace(/(\d{4})(?=\d)/g, "$1-") : ""}
                            onChange={(event) =>
                              setForm((prev) => {
                                if (isAadhaarLocked) return prev;
                                return {
                                  ...prev,
                                  aadhaar: event.target.value.replace(/\D/g, "").slice(0, 12),
                                };
                              })
                            }
                            placeholder="XXXX-XXXX-XXXX"
                            maxLength={14}
                            disabled={isAadhaarLocked}
                          />
                          <span className="field-note">
                            {isAadhaarLocked
                              ? "Aadhaar is locked and cannot be changed once saved."
                              : "Your Aadhaar number is permanent once saved. Please verify carefully."}
                          </span>
                        </div>
                        <div className="field" style={{ gridColumn: "1 / -1" }}>
                          <label>Phone Number</label>
                          <input
                            className="input-style"
                            value={form.phone}
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                phone: event.target.value.replace(/\D/g, "").slice(0, 10),
                              }))
                            }
                            placeholder="Phone number"
                          />
                        </div>
                      </div>

                      <button className="btn btn-dark" style={{ marginTop: 18 }} onClick={() => void handleSave()} disabled={saving}>
                        {saving ? "Updating..." : "Update Profile"}
                      </button>
                    </div>
                  </div>
                </div>

              </>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

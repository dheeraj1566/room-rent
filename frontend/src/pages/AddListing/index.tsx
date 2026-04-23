import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ImageUp, MapPin, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import SiteFooter from "../../components/SiteFooter";
import Select from "../../components/Select";
import { ApiError, apiFetch } from "../../lib/api";
import { forwardGeocode } from "../../lib/googleMaps";
import { useToast } from "../../context/ToastContext";

type LocationOption = {
  area: string;
  colonies: string[];
};

type RoomForm = {
  id: string;
  propertyTypeId: number | "";
  floorLevelId: number | "";
  maxOccupants: number | "";
  monthlyRent: number | "";
  rentPerPerson: number | "";
  furnishingTypeId: number | "";
  foodPreferenceId: number | "";
  foodLevelId: number | "";
  coolingTypeId: number | "";
  bedType: "Single" | "Double" | "Mixed" | "";
  securityDepositType: "none" | "one_month" | "two_month" | "custom" | "";
  securityDepositAmount: number | "";
  availableFrom: string;
  description: string;
  allowSmoking: boolean;
  roomImages: (File | null)[];
  roomImagePreviews: string[];
};

const PROPERTY_TYPE_OPTIONS = [
  { value: "1", label: "PG" },
  { value: "2", label: "Individual" },
  { value: "3", label: "Flat" },
];

const FLOOR_LEVEL_OPTIONS = [
  { value: "1", label: "Ground Floor" },
  { value: "2", label: "1st Floor" },
  { value: "3", label: "2nd Floor" },
  { value: "4", label: "3rd Floor" },
];

const MAX_OCCUPANTS_OPTIONS = [
  { value: "1", label: "1 occupant" },
  { value: "2", label: "2 occupants" },
  { value: "3", label: "3 occupants" },
  { value: "4", label: "4 occupants" },
];

const FURNISHING_OPTIONS = [
  { value: "3", label: "Furnished" },
  { value: "2", label: "Semi-Furnished" },
  { value: "1", label: "Unfurnished" },
];

const FOOD_PREFERENCE_OPTIONS = [
  { value: "1", label: "Veg Only" },
  { value: "2", label: "Non-Veg Allowed" },
  { value: "3", label: "No Restriction" },
];

const FOOD_LEVEL_OPTIONS = [
  { value: "1", label: "Level 1" },
  { value: "2", label: "Level 2" },
  { value: "3", label: "Level 3" },
];

const COOLING_OPTIONS = [
  { value: "1", label: "AC" },
  { value: "2", label: "Non-AC" },
  { value: "3", label: "Cooler" },
];

const BED_TYPE_OPTIONS = [
  { value: "Single", label: "Single" },
  { value: "Double", label: "Double" },
  { value: "Mixed", label: "Mixed" },
];

const SECURITY_DEPOSIT_TYPE_OPTIONS = [
  { value: "none", label: "No deposit" },
  { value: "one_month", label: "1 month rent" },
  { value: "two_month", label: "2 months rent" },
  { value: "custom", label: "Custom amount" },
];

const createRoom = (): RoomForm => ({
  id: crypto.randomUUID(),
  propertyTypeId: "",
  floorLevelId: "",
  maxOccupants: "",
  monthlyRent: "",
  rentPerPerson: "",
  furnishingTypeId: "",
  foodPreferenceId: "",
  foodLevelId: "",
  coolingTypeId: "",
  bedType: "",
  securityDepositType: "",
  securityDepositAmount: "",
  availableFrom: "",
  description: "",
  allowSmoking: false,
  roomImages: [null, null, null],
  roomImagePreviews: ["", "", ""],
});

export default function AddListing() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [houseNo, setHouseNo] = useState("");
  const [landmark, setLandmark] = useState("");
  const [area, setArea] = useState("");
  const [colony, setColony] = useState("");
  const [pincode, setPincode] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [rooms, setRooms] = useState<RoomForm[]>([createRoom()]);
  const [exteriorFile, setExteriorFile] = useState<File | null>(null);
  const [exteriorPreview, setExteriorPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch<{ items: LocationOption[] }>("/api/listings/location-options", { method: "GET" })
      .then((data) => {
        if (!active) return;
        setLocationOptions(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        if (!active) return;
        setLocationOptions([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const areaOptions = useMemo(() => locationOptions.map((item) => item.area), [locationOptions]);
  const colonyOptions = useMemo(
    () => locationOptions.find((item) => item.area === area)?.colonies ?? [],
    [area, locationOptions],
  );

  const areaSelectOptions = useMemo(
    () => areaOptions.map((option) => ({ value: option, label: option })),
    [areaOptions],
  );

  const colonySelectOptions = useMemo(
    () => colonyOptions.map((option) => ({ value: option, label: option })),
    [colonyOptions],
  );

  const composedAddress = useMemo(() => {
    return [houseNo, landmark, colony, area, pincode, "Jaipur", "Rajasthan", "India"]
      .map((item) => item.trim())
      .filter(Boolean)
      .join(", ");
  }, [area, colony, houseNo, landmark, pincode]);

  const updateRoom = (roomId: string, patch: Partial<RoomForm>) => {
    setRooms((prev) => prev.map((room) => {
      if (room.id !== roomId) return room;
      
      const updated = { ...room, ...patch };
      
      // Auto-calculate monthly rent when occupants or per-person rate changes
      if (patch.maxOccupants !== undefined || patch.rentPerPerson !== undefined) {
        const occupants = Number(updated.maxOccupants) || 0;
        const perPersonRate = Number(updated.rentPerPerson) || 0;
        if (occupants > 0 && perPersonRate > 0) {
          updated.monthlyRent = occupants * perPersonRate;
        }
      }
      
      return updated;
    }));
  };

  const handleStepOne = async () => {
    if (!houseNo.trim() || !area || !colony || !/^\d{6}$/.test(pincode)) {
      setErrorMsg("Please fill all required location fields.");
      return;
    }

    setErrorMsg("");
    const result = await forwardGeocode(composedAddress);
    if (result) {
      setCoords({ latitude: result.lat, longitude: result.lng });
    } else {
      setCoords(null);
    }
    setStep(2);
  };

  const handleRoomImage = (roomId: string, index: number, file: File | null) => {
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id !== roomId) return room;
        const nextImages = [...room.roomImages];
        const nextPreviews = [...room.roomImagePreviews];
        nextImages[index] = file;
        nextPreviews[index] = file ? URL.createObjectURL(file) : "";
        return { ...room, roomImages: nextImages, roomImagePreviews: nextPreviews };
      }),
    );
  };

  const validateRooms = () => {
    for (const room of rooms) {
      const isPG = Number(room.propertyTypeId) === 1;
      const isIndividual = Number(room.propertyTypeId) === 2;
      const isFlat = Number(room.propertyTypeId) === 3;
      const needsAdvanced = isPG || isIndividual || isFlat;
      if (
        room.propertyTypeId === "" ||
        room.floorLevelId === "" ||
        room.maxOccupants === "" ||
        room.rentPerPerson === "" ||
        room.furnishingTypeId === "" ||
        room.foodPreferenceId === "" ||
        room.coolingTypeId === "" ||
        ((isPG || isFlat) && room.foodLevelId === "") ||
        (needsAdvanced && room.bedType === "") ||
        (needsAdvanced && room.securityDepositType === "") ||
        (needsAdvanced && room.securityDepositType === "custom" && room.securityDepositAmount === "") ||
        !room.availableFrom ||
        !room.description.trim()
      ) {
        return "Please complete all room details before publishing.";
      }
      if (!room.roomImages.some(Boolean)) {
        return "Each room needs at least one image.";
      }
    }
    if (!exteriorFile) {
      return "Please upload an exterior image.";
    }
    return "";
  };

  const handleSubmit = async () => {
    const validationError = validateRooms();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const formData = new FormData();
      const payload = {
        location: coords ?? undefined,
        address: composedAddress,
        exteriorPhotoUrl: "",
        roomPhotoUrls: rooms.map((room) => room.roomImagePreviews.map(() => "")),
        rooms: rooms.map((room) => ({
          ...(Number(room.propertyTypeId) === 1 || Number(room.propertyTypeId) === 2 || Number(room.propertyTypeId) === 3
            ? (() => {
                const monthly = Number(room.monthlyRent) || 0;
                const depositType = room.securityDepositType;
                const deposit =
                  depositType === "none"
                    ? 0
                    : depositType === "one_month"
                      ? monthly
                    : depositType === "two_month"
                      ? monthly * 2
                      : room.securityDepositAmount === ""
                        ? null
                        : Number(room.securityDepositAmount);

                const bedType = room.bedType || (Number(room.maxOccupants) > 1 ? "Double" : "Single");
                const beds =
                  bedType === "Single"
                    ? { singleBedCount: 1, doubleBedCount: 0 }
                    : bedType === "Double"
                      ? { singleBedCount: 0, doubleBedCount: 1 }
                      : { singleBedCount: 1, doubleBedCount: 1 };

                return {
                  bedType,
                  securityDeposit: deposit,
                  ...beds,
                };
              })()
            : {
                securityDeposit: null,
                bedType: Number(room.maxOccupants) > 1 ? "Double" : "Single",
                singleBedCount: Number(room.maxOccupants) === 1 ? 1 : 0,
                doubleBedCount: Number(room.maxOccupants) > 1 ? 1 : 0,
              }),
          propertyTypeId: Number(room.propertyTypeId),
          floorLevelId: Number(room.floorLevelId),
          maxOccupants: Number(room.maxOccupants),
          monthlyRent: Number(room.monthlyRent),
          furnishingTypeId: Number(room.furnishingTypeId),
          foodPreferenceId: Number(room.foodPreferenceId),
          foodLevelId: Number(room.foodLevelId) || 1,
          coolingTypeId: Number(room.coolingTypeId),
          availableFrom: room.availableFrom,
          description: room.description.trim(),
          allowSmoking: room.allowSmoking,
          rentTiers: [],
        })),
      };

      formData.append("data", JSON.stringify(payload));
      formData.append("exteriorFile", exteriorFile as File);

      rooms.forEach((room, roomIndex) => {
        room.roomImages.forEach((file, imageIndex) => {
          if (file) {
            formData.append(`roomFile-${roomIndex}-${imageIndex}`, file);
          }
        });
      });

      await apiFetch("/api/listings/submit", {
        method: "POST",
        body: formData,
      });

      setStep(3);
      showToast("Listing posted successfully", "success");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        navigate("/login");
        return;
      }
      setErrorMsg(error instanceof Error ? error.message : "Failed to publish listing");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <Navbar />

      <main className="page-shell">
        <section className="hero-panel hero-gradient">
          <div className="page-container" style={{ padding: "46px 0 56px" }}>
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: "clamp(2.1rem, 5vw, 3.4rem)", lineHeight: 1.06, marginBottom: 10 }}>Post Your Property</h1>
              <p className="section-subtitle">
                {step === 1 && "Tell us where your property is located"}
                {step === 2 && "Tell us about your property details"}
                {step === 3 && "Your property is now live!"}
              </p>

              <div className="stepper">
                <div className="stepper-bars">
                  <span className={step >= 2 ? "done" : step === 1 ? "active" : ""} />
                  <span className={step === 3 ? "done" : step === 2 ? "active" : ""} />
                  <span className={step === 3 ? "active" : ""} />
                </div>
                <div className="stepper-label">STEP {step} OF 3</div>
              </div>
            </div>

            {step === 1 ? (
              <div className="form-panel" style={{ width: "min(920px, 100%)", margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "start", gap: 14, marginBottom: 26 }}>
                  <div className="feature-icon" style={{ marginBottom: 0 }}>
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: "clamp(1.45rem, 3.2vw, 2rem)", marginBottom: 4 }}>Where is your property located?</h2>
                    <p>We'll precisely pinpoint your location to help tenants find you easily.</p>
                  </div>
                </div>

                <div className="field-grid-2">
                  <div className="field">
                    <label>House No. *</label>
                    <input className="input-style" value={houseNo} onChange={(e) => setHouseNo(e.target.value)} placeholder="e.g. 24/7 or A123" />
                  </div>
                  <div className="field">
                    <label>Landmark (Optional)</label>
                    <input className="input-style" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="e.g. Near SBI Bank" />
                  </div>
                  <div className="field">
                    <label>Area *</label>
                    <Select
                      value={area}
                      onChange={(next) => {
                        setArea(next);
                        setColony("");
                      }}
                      options={areaSelectOptions}
                      placeholder="Select area"
                      aria-label="Select area"
                    />
                  </div>
                  <div className="field">
                    <label>Colony *</label>
                    <Select
                      value={colony}
                      onChange={(next) => setColony(next)}
                      options={colonySelectOptions}
                      placeholder={area ? "Select colony" : "Select area first"}
                      aria-label="Select colony"
                      disabled={!area}
                    />
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label>Pincode *</label>
                    <input
                      className="input-style"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="e.g. 302017"
                    />
                  </div>
                </div>

                {errorMsg ? <div className="error-banner" style={{ marginTop: 20 }}>{errorMsg}</div> : null}

                <div className="form-actions" style={{ justifyContent: "flex-end" }}>
                  <button className="btn btn-dark" onClick={() => void handleStepOne()}>
                    Continue to Room Details
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div style={{ width: "min(980px, 100%)", margin: "0 auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: "clamp(1.45rem, 3.2vw, 2rem)" }}>Room Details</h2>
                  <button className="btn btn-outline" onClick={() => setRooms((prev) => [...prev, createRoom()])}>
                    <Plus size={18} />
                    Add Another Room
                  </button>
                </div>

                {rooms.map((room, roomIndex) => (
                  <div key={room.id} className="form-panel" style={{ marginBottom: 22 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 18 }}>
                      <h3 style={{ fontSize: "1.45rem" }}>Room {roomIndex + 1}</h3>
                      {rooms.length > 1 ? (
                        <button className="btn btn-outline btn-sm" onClick={() => setRooms((prev) => prev.filter((item) => item.id !== room.id))}>
                          <Trash2 size={16} />
                          Remove
                        </button>
                      ) : null}
                    </div>

                    <div className="field-grid-2">
                      {(() => {
                        const isPG = Number(room.propertyTypeId) === 1;
                        const isIndividual = Number(room.propertyTypeId) === 2;
                        const isFlat = Number(room.propertyTypeId) === 3;
                        const needsAdvanced = isPG || isIndividual || isFlat;
                        const monthly = Number(room.monthlyRent) || 0;
                        const depositPreview =
                          room.securityDepositType === "none"
                            ? 0
                            : room.securityDepositType === "one_month"
                              ? monthly
                              : room.securityDepositType === "two_month"
                                ? monthly * 2
                                : room.securityDepositAmount === ""
                                  ? 0
                                  : Number(room.securityDepositAmount);

                        return (
                          <>
                      <div className="field">
                        <label>Property Type *</label>
                        <Select
                          value={room.propertyTypeId === "" ? "" : String(room.propertyTypeId)}
                          onChange={(next) =>
                            updateRoom(room.id, {
                              propertyTypeId: next ? Number(next) : "",
                              ...(next !== "1" && next !== "2" && next !== "3"
                                ? { bedType: "", securityDepositType: "", securityDepositAmount: "", foodLevelId: "" }
                                : {}),
                            })
                          }
                          options={PROPERTY_TYPE_OPTIONS}
                          placeholder="Select property type"
                          aria-label="Property type"
                        />
                      </div>

                      <div className="field">
                        <label>Floor Level *</label>
                        <Select
                          value={room.floorLevelId === "" ? "" : String(room.floorLevelId)}
                          onChange={(next) => updateRoom(room.id, { floorLevelId: next ? Number(next) : "" })}
                          options={FLOOR_LEVEL_OPTIONS}
                          placeholder="Select floor"
                          aria-label="Floor level"
                        />
                      </div>

                      <div className="field">
                        <label>Max Occupants *</label>
                        <Select
                          value={room.maxOccupants === "" ? "" : String(room.maxOccupants)}
                          onChange={(next) => updateRoom(room.id, { maxOccupants: next ? Number(next) : "" })}
                          options={MAX_OCCUPANTS_OPTIONS}
                          placeholder="Select max occupants"
                          aria-label="Max occupants"
                        />
                      </div>

                      <div className="field">
                        <label>Rent per Person (₹) *</label>
                        <input
                          className="input-style"
                          value={room.rentPerPerson}
                          onChange={(e) => updateRoom(room.id, { rentPerPerson: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : "" })}
                          placeholder="e.g. 8000"
                        />
                        {room.maxOccupants && room.rentPerPerson ? (
                          <span className="field-note" style={{ color: "var(--green-600)", fontWeight: 600 }}>
                            Total Monthly Rent: ₹{(Number(room.maxOccupants) * Number(room.rentPerPerson)).toLocaleString("en-IN")}
                          </span>
                        ) : null}
                      </div>

                      <div className="field">
                        <label>Furnishing *</label>
                        <Select
                          value={room.furnishingTypeId === "" ? "" : String(room.furnishingTypeId)}
                          onChange={(next) => updateRoom(room.id, { furnishingTypeId: next ? Number(next) : "" })}
                          options={FURNISHING_OPTIONS}
                          placeholder="Select furnishing"
                          aria-label="Furnishing"
                        />
                      </div>

                      {isPG || isFlat ? (
                        <div className="field">
                          <label>Food Level *</label>
                          <Select
                            value={room.foodLevelId === "" ? "" : String(room.foodLevelId)}
                            onChange={(next) => updateRoom(room.id, { foodLevelId: next ? Number(next) : "" })}
                            options={FOOD_LEVEL_OPTIONS}
                            placeholder="Select food level"
                            aria-label="Food level"
                          />
                        </div>
                      ) : null}

                      {needsAdvanced ? (
                        <div className="field">
                          <label>Bed Type *</label>
                          <Select
                            value={room.bedType}
                            onChange={(next) => updateRoom(room.id, { bedType: next as RoomForm["bedType"] })}
                            options={BED_TYPE_OPTIONS}
                            placeholder="Select bed type"
                            aria-label="Bed type"
                          />
                        </div>
                      ) : null}

                      <div className="field">
                        <label>Food Preference *</label>
                        <Select
                          value={room.foodPreferenceId === "" ? "" : String(room.foodPreferenceId)}
                          onChange={(next) => updateRoom(room.id, { foodPreferenceId: next ? Number(next) : "" })}
                          options={FOOD_PREFERENCE_OPTIONS}
                          placeholder="Select food preference"
                          aria-label="Food preference"
                        />
                      </div>

                      <div className="field">
                        <label>Cooling Type *</label>
                        <Select
                          value={room.coolingTypeId === "" ? "" : String(room.coolingTypeId)}
                          onChange={(next) => updateRoom(room.id, { coolingTypeId: next ? Number(next) : "" })}
                          options={COOLING_OPTIONS}
                          placeholder="Select cooling type"
                          aria-label="Cooling type"
                        />
                      </div>

                      {needsAdvanced ? (
                        <div className="field" style={{ gridColumn: "1 / -1" }}>
                          <label>Security Deposit (₹) *</label>
                          <div className="field-grid-2" style={{ gap: 12 }}>
                            <div className="field" style={{ gap: 8 }}>
                              <Select
                                value={room.securityDepositType}
                                onChange={(next) =>
                                  updateRoom(room.id, {
                                    securityDepositType: next as RoomForm["securityDepositType"],
                                    ...(next !== "custom" ? { securityDepositAmount: "" } : {}),
                                  })
                                }
                                options={SECURITY_DEPOSIT_TYPE_OPTIONS}
                                placeholder="Select deposit type"
                                aria-label="Security deposit type"
                              />
                              {room.securityDepositType && room.securityDepositType !== "custom" ? (
                                <span className="field-note">Deposit: ₹{depositPreview.toLocaleString("en-IN")}</span>
                              ) : null}
                            </div>

                            {room.securityDepositType === "custom" ? (
                              <div className="field" style={{ gap: 8 }}>
                                <input
                                  className="input-style"
                                  value={room.securityDepositAmount}
                                  onChange={(e) =>
                                    updateRoom(room.id, {
                                      securityDepositAmount: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : "",
                                    })
                                  }
                                  placeholder="Enter deposit amount"
                                />
                                <span className="field-note">Enter a fixed deposit amount in ₹.</span>
                              </div>
                            ) : (
                              <div className="field" style={{ gap: 8 }}>
                                <input
                                  className="input-style"
                                  value={depositPreview ? `₹${depositPreview.toLocaleString("en-IN")}` : ""}
                                  placeholder="Deposit amount"
                                  disabled
                                />
                                <span className="field-note">Auto-calculated from monthly rent.</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}

                      <div className="field">
                        <label>Available From *</label>
                        <input
                          className="input-style"
                          type="date"
                          value={room.availableFrom}
                          onChange={(e) => updateRoom(room.id, { availableFrom: e.target.value })}
                          placeholder="dd/mm/yyyy"
                        />
                      </div>

                      <div className="field">
                        <label>Smoking Allowed</label>
                        <div className="radio-inline" style={{ minHeight: 56 }}>
                          <label className="checkbox-item">
                            <input
                              type="radio"
                              checked={room.allowSmoking === true}
                              onChange={() => updateRoom(room.id, { allowSmoking: true })}
                              name={`smoking-${room.id}`}
                            />
                            <span>Yes</span>
                          </label>
                          <label className="checkbox-item">
                            <input
                              type="radio"
                              checked={room.allowSmoking === false}
                              onChange={() => updateRoom(room.id, { allowSmoking: false })}
                              name={`smoking-${room.id}`}
                            />
                            <span>No</span>
                          </label>
                        </div>
                      </div>

                      <div className="field" style={{ gridColumn: "1 / -1" }}>
                        <label>Description *</label>
                        <textarea
                          className="textarea-style"
                          value={room.description}
                          onChange={(e) => updateRoom(room.id, { description: e.target.value })}
                          placeholder="Add highlights of this property"
                        />
                      </div>

                      <div className="field" style={{ gridColumn: "1 / -1" }}>
                        <label>Room Images (up to 3, at least 1 required) *</label>
                        <div className="upload-grid">
                          {room.roomImagePreviews.map((preview, imageIndex) => (
                            <label key={`${room.id}-${imageIndex}`} className={`upload-card ${preview ? "has-image" : ""}`}>
                              {preview ? <img src={preview} alt={`Room ${roomIndex + 1} ${imageIndex + 1}`} /> : null}
                              {!preview ? (
                                <>
                                  <ImageUp size={24} style={{ position: "relative", zIndex: 1 }} />
                                  <span style={{ position: "relative", zIndex: 1 }}>Image {imageIndex + 1}</span>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    handleRoomImage(room.id, imageIndex, null);
                                  }}
                                >
                                  Remove
                                </button>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                onChange={(event) => handleRoomImage(room.id, imageIndex, event.target.files?.[0] ?? null)}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ))}

                <div className="form-panel">
                  <div className="field">
                    <label>Exterior Image *</label>
                    <div className="upload-grid" style={{ gridTemplateColumns: "minmax(0, 260px)" }}>
                      <label className={`upload-card ${exteriorPreview ? "has-image" : ""}`}>
                        {exteriorPreview ? <img src={exteriorPreview} alt="Exterior" /> : null}
                        {!exteriorPreview ? (
                          <>
                            <ImageUp size={24} style={{ position: "relative", zIndex: 1 }} />
                            <span style={{ position: "relative", zIndex: 1 }}>Upload File</span>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={(event) => {
                              event.preventDefault();
                              setExteriorFile(null);
                              setExteriorPreview("");
                            }}
                          >
                            Remove
                          </button>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            setExteriorFile(file);
                            setExteriorPreview(URL.createObjectURL(file));
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {errorMsg ? <div className="error-banner">{errorMsg}</div> : null}

                <div className="form-actions">
                  <button className="btn btn-outline" onClick={() => setStep(1)}>
                    <ArrowLeft size={18} />
                    Back
                  </button>
                  <button className="btn btn-primary" onClick={() => void handleSubmit()} disabled={submitting}>
                    {submitting ? "Publishing..." : "Publish Listing"}
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="surface-card success-card">
                <div className="success-mark">
                  <Check size={54} />
                </div>
                <h2 style={{ fontSize: "3rem", marginBottom: 12 }}>Successfully Published!</h2>
                <p style={{ fontSize: "1.18rem", marginBottom: 28 }}>
                  Your property is now active and visible to potential tenants.
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
                  <button className="btn btn-dark" onClick={() => navigate("/my-properties")}>
                    View All Listings
                  </button>
                  <button className="btn btn-outline" onClick={() => navigate("/profile")}>
                    Go to Profile
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

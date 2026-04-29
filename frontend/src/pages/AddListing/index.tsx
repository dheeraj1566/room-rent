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
  maxOccupants: number | "";
  monthlyRent: number | "";
  rentTiers: { occupants: number; rent: number | "" }[];
  furnishingTypeId: number | "";
  foodPreferenceId: number | "";
  foodLevelId: number | "";
  coolingTypeId: number | "";
  bedType: "Single" | "Double" | "Mixed" | "";
  singleBedCount: number | "";
  doubleBedCount: number | "";
  securityDepositType: "none" | "one_month" | "two_month" | "custom" | "";
  securityDepositAmount: number | "";
  availableFrom: string;
  description: string;
  allowSmoking: boolean;
  roomFor: "Male" | "Female" | "Any" | "";
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
  { value: "5", label: "Roof" },
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
  maxOccupants: "",
  monthlyRent: "",
  rentTiers: [],
  furnishingTypeId: "",
  foodPreferenceId: "",
  foodLevelId: "",
  coolingTypeId: "",
  bedType: "",
  singleBedCount: "",
  doubleBedCount: "",
  securityDepositType: "",
  securityDepositAmount: "",
  availableFrom: "",
  description: "",
  allowSmoking: false,
  roomFor: "",
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
  const [propertyTypeId, setPropertyTypeId] = useState<number | "">("");
  const [floorLevelId, setFloorLevelId] = useState<number | "">("");
  const [rooms, setRooms] = useState<RoomForm[]>([createRoom()]);
  const [exteriorFile, setExteriorFile] = useState<File | null>(null);
  const [exteriorPreview, setExteriorPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [step1Submitted, setStep1Submitted] = useState(false);
  const [step2Submitted, setStep2Submitted] = useState(false);

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
      
      // Generate rent tiers when max occupants changes
      if (patch.maxOccupants !== undefined) {
        const maxOccupants = Number(updated.maxOccupants);
        if (maxOccupants > 0) {
          const newTiers: { occupants: number; rent: number | "" }[] = [];
          for (let i = 1; i <= maxOccupants; i++) {
            const existingTier = room.rentTiers.find(tier => tier.occupants === i);
            newTiers.push({
              occupants: i,
              rent: existingTier?.rent || ""
            });
          }
          updated.rentTiers = newTiers;
        } else {
          updated.rentTiers = [];
        }
      }
      
      return updated;
    }));
  };

  const updateRentTier = (roomId: string, occupants: number, rent: number | "") => {
    setRooms((prev) => prev.map((room) => {
      if (room.id !== roomId) return room;
      
      const updatedTiers = room.rentTiers.map(tier => 
        tier.occupants === occupants ? { ...tier, rent } : tier
      );
      
      // Update monthlyRent to the rent for max occupants
      const maxOccupants = Number(room.maxOccupants);
      const maxOccupantsTier = updatedTiers.find(tier => tier.occupants === maxOccupants);
      const monthlyRent = maxOccupantsTier && maxOccupantsTier.rent !== "" ? Number(maxOccupantsTier.rent) : "";
      
      return { ...room, rentTiers: updatedTiers, monthlyRent };
    }));
  };

  const handleStepOne = async () => {
    setStep1Submitted(true);
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
    if (propertyTypeId === "") return "Please select a Property Type.";
    if (floorLevelId === "") return "Please select a Floor Level.";

    const isPG = Number(propertyTypeId) === 1;
    const isIndividual = Number(propertyTypeId) === 2;
    const isFlat = Number(propertyTypeId) === 3;
    const needsAdvanced = isPG || isIndividual || isFlat;

    for (const room of rooms) {
      const maxOccupants = Number(room.maxOccupants);
      
      // Check if rent for max occupants is set
      const maxOccupantsRent = room.rentTiers.find(tier => tier.occupants === maxOccupants)?.rent;
      
      if (
        room.maxOccupants === "" ||
        !maxOccupantsRent || Number(maxOccupantsRent) === 0 ||
        room.furnishingTypeId === "" ||
        room.foodPreferenceId === "" ||
        room.coolingTypeId === "" ||
        ((isPG || isFlat) && room.foodLevelId === "") ||
        (needsAdvanced && room.bedType === "") ||
        (needsAdvanced && (room.bedType === "Single" || room.bedType === "Mixed") && room.singleBedCount === "") ||
        (needsAdvanced && (room.bedType === "Double" || room.bedType === "Mixed") && room.doubleBedCount === "") ||
        (needsAdvanced && room.securityDepositType === "") ||
        (needsAdvanced && room.securityDepositType === "custom" && room.securityDepositAmount === "") ||
        !room.availableFrom
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
    setStep2Submitted(true);
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
          ...(Number(propertyTypeId) === 1 || Number(propertyTypeId) === 2 || Number(propertyTypeId) === 3
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
                    ? { singleBedCount: Number(room.singleBedCount) || 1, doubleBedCount: 0 }
                    : bedType === "Double"
                      ? { singleBedCount: 0, doubleBedCount: Number(room.doubleBedCount) || 1 }
                      : { singleBedCount: Number(room.singleBedCount) || 1, doubleBedCount: Number(room.doubleBedCount) || 1 };

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
          propertyTypeId: Number(propertyTypeId),
          floorLevelId: Number(floorLevelId),
          maxOccupants: Number(room.maxOccupants),
          monthlyRent: Number(room.monthlyRent),
          furnishingTypeId: Number(room.furnishingTypeId),
          foodPreferenceId: Number(room.foodPreferenceId),
          foodLevelId: Number(room.foodLevelId) || 1,
          coolingTypeId: Number(room.coolingTypeId),
          availableFrom: room.availableFrom,
          description: room.description.trim(),
          allowSmoking: room.allowSmoking,
          roomFor: room.roomFor || undefined,
          rentTiers: room.rentTiers
            .filter(tier => tier.rent !== "" && tier.rent !== null)
            .map(tier => ({
              occupants: tier.occupants,
              rent: Number(tier.rent)
            })),
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
                    <input className={`input-style${step1Submitted && !houseNo.trim() ? " input-error" : ""}`} value={houseNo} onChange={(e) => setHouseNo(e.target.value)} placeholder="e.g. 24/7 or A123" />
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
                      searchable
                      className={step1Submitted && !area ? "input-error" : ""}
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
                      searchable
                      className={step1Submitted && !colony ? "input-error" : ""}
                    />
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label>Pincode *</label>
                    <input
                      className={`input-style${step1Submitted && !/^\d{6}$/.test(pincode) ? " input-error" : ""}`}
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

                {/* Common fields shared across all rooms */}
                <div className="form-panel" style={{ marginBottom: 22 }}>
                  <h3 style={{ fontSize: "1.1rem", marginBottom: 16 }}>Property Details (applies to all rooms)</h3>
                  <div className="field-grid-2">
                    <div className="field">
                      <label>Property Type *</label>
                      <Select
                        value={propertyTypeId === "" ? "" : String(propertyTypeId)}
                        onChange={(next) => setPropertyTypeId(next ? Number(next) : "")}
                        options={PROPERTY_TYPE_OPTIONS}
                        placeholder="Select property type"
                        aria-label="Property type"
                        className={step2Submitted && propertyTypeId === "" ? "input-error" : ""}
                      />
                    </div>
                    <div className="field">
                      <label>Floor Level *</label>
                      <Select
                        value={floorLevelId === "" ? "" : String(floorLevelId)}
                        onChange={(next) => setFloorLevelId(next ? Number(next) : "")}
                        options={FLOOR_LEVEL_OPTIONS}
                        placeholder="Select floor"
                        aria-label="Floor level"
                        className={step2Submitted && floorLevelId === "" ? "input-error" : ""}
                      />
                    </div>
                  </div>
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
                        const isPG = Number(propertyTypeId) === 1;
                        const isIndividual = Number(propertyTypeId) === 2;
                        const isFlat = Number(propertyTypeId) === 3;
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
                        <label>Max Occupants *</label>
                        <Select
                          value={room.maxOccupants === "" ? "" : String(room.maxOccupants)}
                          onChange={(next) => updateRoom(room.id, { maxOccupants: next ? Number(next) : "" })}
                          options={MAX_OCCUPANTS_OPTIONS}
                          placeholder="Select max occupants"
                          aria-label="Max occupants"
                          className={step2Submitted && room.maxOccupants === "" ? "input-error" : ""}
                        />
                      </div>

                      {/* Monthly Rent Field - Always Visible */}
                      <div className="field">
                        <label>Monthly Rent (₹) * {room.maxOccupants && Number(room.maxOccupants) > 0 ? <span style={{ color: "var(--text-secondary)" }}>for {room.maxOccupants} occupants</span> : null}</label>
                        <input
                          className={`input-style${step2Submitted && !(room.rentTiers.find(t => t.occupants === Number(room.maxOccupants))?.rent) ? " input-error" : ""}`}
                          value={room.maxOccupants && Number(room.maxOccupants) > 0 ? (room.rentTiers.find(tier => tier.occupants === Number(room.maxOccupants))?.rent || "") : room.monthlyRent}
                          onChange={(e) => {
                            const value = e.target.value ? Number(e.target.value.replace(/\D/g, "")) : "";
                            if (room.maxOccupants && Number(room.maxOccupants) > 0) {
                              updateRentTier(room.id, Number(room.maxOccupants), value);
                            } else {
                              updateRoom(room.id, { monthlyRent: value });
                            }
                          }}
                          placeholder="e.g. 12000"
                        />
                      </div>

                      {/* Dynamic Rent Tiers for Lower Occupancy */}
                      {room.maxOccupants && Number(room.maxOccupants) > 1 ? (
                        <div style={{ gridColumn: "1 / -1" }}>
                          <div className="field-grid-2">
                            {Array.from({ length: Number(room.maxOccupants) - 1 }, (_, index) => {
                              const occupants = Number(room.maxOccupants) - 1 - index;
                              const tierRent = room.rentTiers.find(tier => tier.occupants === occupants)?.rent || "";
                              return (
                                <div key={occupants} className="field">
                                  <label>Rent for {occupants} Occupant{occupants > 1 ? 's' : ''} (₹)</label>
                                  <input
                                    className="input-style"
                                    value={tierRent}
                                    onChange={(e) => updateRentTier(room.id, occupants, e.target.value ? Number(e.target.value.replace(/\D/g, "")) : "")}
                                    placeholder={`e.g. ${Math.max(1000, Number(room.rentTiers.find(tier => tier.occupants === Number(room.maxOccupants))?.rent || 0) - 1000 * (Number(room.maxOccupants) - occupants))}`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <div className="field">
                        <label>Furnishing *</label>
                        <Select
                          value={room.furnishingTypeId === "" ? "" : String(room.furnishingTypeId)}
                          onChange={(next) => updateRoom(room.id, { furnishingTypeId: next ? Number(next) : "" })}
                          options={FURNISHING_OPTIONS}
                          placeholder="Select furnishing"
                          aria-label="Furnishing"
                          className={step2Submitted && room.furnishingTypeId === "" ? "input-error" : ""}
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
                            className={step2Submitted && room.foodLevelId === "" ? "input-error" : ""}
                          />
                        </div>
                      ) : null}

                      {needsAdvanced ? (
                        <div className="field">
                          <label>Bed Type *</label>
                          <Select
                            value={room.bedType}
                            onChange={(next) => updateRoom(room.id, {
                              bedType: next as RoomForm["bedType"],
                              singleBedCount: "",
                              doubleBedCount: "",
                            })}
                            options={BED_TYPE_OPTIONS}
                            placeholder="Select bed type"
                            aria-label="Bed type"
                            className={step2Submitted && !room.bedType ? "input-error" : ""}
                          />
                        </div>
                      ) : null}

                      {needsAdvanced && (room.bedType === "Single" || room.bedType === "Mixed") ? (
                        <div className="field">
                          <label>Single Bed Count *</label>
                          <input
                            className={`input-style${step2Submitted && room.singleBedCount === "" ? " input-error" : ""}`}
                            type="number"
                            min="1"
                            value={room.singleBedCount}
                            onChange={(e) => updateRoom(room.id, { singleBedCount: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : "" })}
                            placeholder="How many single beds in the room?"
                          />
                        </div>
                      ) : null}

                      {needsAdvanced && (room.bedType === "Double" || room.bedType === "Mixed") ? (
                        <div className="field">
                          <label>Double Bed Count *</label>
                          <input
                            className={`input-style${step2Submitted && room.doubleBedCount === "" ? " input-error" : ""}`}
                            type="number"
                            min="1"
                            value={room.doubleBedCount}
                            onChange={(e) => updateRoom(room.id, { doubleBedCount: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : "" })}
                            placeholder="How many double beds in the room?"
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
                          className={step2Submitted && room.foodPreferenceId === "" ? "input-error" : ""}
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
                          className={step2Submitted && room.coolingTypeId === "" ? "input-error" : ""}
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
                                className={step2Submitted && !room.securityDepositType ? "input-error" : ""}
                              />
                              {room.securityDepositType && room.securityDepositType !== "custom" ? (
                                <span className="field-note">Deposit: ₹{depositPreview.toLocaleString("en-IN")}</span>
                              ) : null}
                            </div>

                            {room.securityDepositType === "custom" ? (
                              <div className="field" style={{ gap: 8 }}>
                                <input
                                  className={`input-style${step2Submitted && room.securityDepositAmount === "" ? " input-error" : ""}`}
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
                          className={`input-style${step2Submitted && !room.availableFrom ? " input-error" : ""}`}
                          type="date"
                          value={room.availableFrom}
                          onChange={(e) => updateRoom(room.id, { availableFrom: e.target.value })}
                          placeholder="dd/mm/yyyy"
                        />
                      </div>

                      <div className="field">
                        <label>Room For</label>
                        <div className="radio-inline" style={{ minHeight: 56 }}>
                          {(["Male", "Female", "Any"] as const).map((option) => (
                            <label key={option} className="checkbox-item">
                              <input
                                type="radio"
                                checked={room.roomFor === option}
                                onChange={() => updateRoom(room.id, { roomFor: option })}
                                name={`roomFor-${room.id}`}
                              />
                              <span>{option}</span>
                            </label>
                          ))}
                        </div>
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
                        <label>Description</label>
                        <textarea
                          className="textarea-style"
                          value={room.description}
                          onChange={(e) => updateRoom(room.id, { description: e.target.value })}
                          placeholder="Add highlights of this property"
                        />
                      </div>

                      <div className="field" style={{ gridColumn: "1 / -1" }}>
                        <label>Room Images (up to 3, at least 1 required) *</label>
                        <div className={`upload-grid${step2Submitted && !room.roomImages.some(Boolean) ? " upload-grid-error" : ""}` }>
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
                                onChange={(event) => {
                                  handleRoomImage(room.id, imageIndex, event.target.files?.[0] ?? null);
                                  event.target.value = "";
                                }}
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
                    <div className={`upload-grid${step2Submitted && !exteriorFile ? " upload-grid-error" : ""}`} style={{ gridTemplateColumns: "minmax(0, 260px)" }}>
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

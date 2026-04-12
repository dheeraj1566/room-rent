import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Send, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import Navbar from '../../components/Navbar';
import {
  forwardGeocode,
} from '../../lib/googleMaps';

interface LocationState {
  latitude: number;
  longitude: number;
}

const FALLBACK_AREA_OPTIONS = [
  'Sanganer',
  'Malviya Nagar',
  'Mansarovar',
  'Jagatpura',
  'Vaishali Nagar',
  'Tonk Phatak',
  'Vidhyadhar Nagar',
];

const FALLBACK_COLONY_OPTIONS_BY_AREA: Record<string, string[]> = {
  Sanganer: ['Saini Colony', 'Panchwati Colony', 'Sitaram Colony', 'Nand Colony', 'Kohinoor Nagar'],
  'Malviya Nagar': ['Model Town', 'Shanti Nagar', 'Patel Colony', 'Sector 1', 'Sector 9'],
  Mansarovar: ['Patel Marg', 'Agarwal Farm', 'Rajat Path', 'Shipra Path', 'Madhyam Marg'],
  Jagatpura: ['Ramnagariya', 'Ashadeep Green Avenue', 'Mahima Panache', 'Ramnagariya South'],
  'Vaishali Nagar': ['Gandhi Path', 'Nemi Nagar', 'Chitrakoot', 'Hanuman Nagar', 'Queens Road'],
  'Tonk Phatak': ['Barkat Nagar', 'Gopalpura Bypass', 'Mahesh Nagar', 'Lal Kothi'],
  'Vidhyadhar Nagar': ['Sector 1', 'Sector 2', 'Sector 3', 'Sector 5', 'Central Spine'],
};

type LocationOption = {
  area: string;
  colonies: string[];
};

interface RoomDetails {
  id: string; // for React keys
  floorLevelId: number | '';
  maxOccupants: number | '';
  foodPreferenceId: number | '';
  allowSmoking: boolean;
  monthlyRent: number | '';
  furnishingTypeId: number | '';
  availableFrom: string;
  description: string;
  securityDeposit: number | '';
  propertyTypeId: number | '';
  foodLevelId: number | '';
  bedType: 'Single' | 'Double' | 'Mixed' | '';
  singleBedCount: number | '';
  doubleBedCount: number | '';
}
type RoomPayload = Omit<RoomDetails, 'id'>;

type UploadSlot = 'exterior' | `room-${number}-${number}`;
const IMAGES_PER_ROOM = 3;
const createEmptyRoomImages = () => Array.from({ length: IMAGES_PER_ROOM }, () => '');
const createEmptyRoomFiles = () => Array.from({ length: IMAGES_PER_ROOM }, () => null as File | null);
const createEmptyRoom = (): RoomDetails => ({
  id: crypto.randomUUID(),
  floorLevelId: '',
  maxOccupants: '',
  foodPreferenceId: '',
  allowSmoking: false,
  monthlyRent: '',
  furnishingTypeId: '',
  availableFrom: '',
  description: '',
  securityDeposit: '',
  propertyTypeId: '',
  foodLevelId: '',
  bedType: '',
  singleBedCount: '',
  doubleBedCount: '',
});

export default function AddListing() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Location, 2: Rooms, 3: Success
  const [location, setLocation] = useState<LocationState | null>(null);
  const [address, setAddress] = useState<string>('');
  const [houseNo, setHouseNo] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [area, setArea] = useState('');
  const [colony, setColony] = useState('');
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exteriorPhotoUrl, setExteriorPhotoUrl] = useState('');
  const [exteriorPhotoFile, setExteriorPhotoFile] = useState<File | null>(null);
  const [roomPhotoUrls, setRoomPhotoUrls] = useState<string[][]>([createEmptyRoomImages()]);
  const [roomPhotoFiles, setRoomPhotoFiles] = useState<(File | null)[][]>([createEmptyRoomFiles()]);
  
  const [rooms, setRooms] = useState<RoomDetails[]>([createEmptyRoom()]);

  const areaToColonies = useMemo(() => {
    if (locationOptions.length === 0) return FALLBACK_COLONY_OPTIONS_BY_AREA;
    const mapped: Record<string, string[]> = {};
    locationOptions.forEach((item) => {
      mapped[item.area] = item.colonies;
    });
    return mapped;
  }, [locationOptions]);
  const areaOptions = useMemo(
    () => (locationOptions.length ? locationOptions.map((item) => item.area) : FALLBACK_AREA_OPTIONS),
    [locationOptions]
  );
  const colonyOptions = useMemo(() => (area ? (areaToColonies[area] ?? []) : []), [area, areaToColonies]);

  useEffect(() => {
    let mounted = true;
    const loadLocationOptions = async () => {
      try {
        const response = await apiFetch<{ items: LocationOption[] }>('/api/listings/location-options', {
          method: 'GET',
        });
        if (!mounted) return;
        if (Array.isArray(response.items) && response.items.length > 0) {
          setLocationOptions(response.items);
        }
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 401) {
          navigate('/login');
        }
      }
    };
    void loadLocationOptions();
    return () => {
      mounted = false;
    };
  }, [navigate]);
  const composedAddress = useMemo(() => {
    const parts = [
      houseNo.trim(),
      landmark.trim(),
      colony.trim(),
      area.trim(),
      pincode.trim(),
      'Jaipur',
      'Rajasthan',
      'India',
    ].filter(Boolean);
    return parts.join(', ');
  }, [houseNo, landmark, colony, area, pincode]);
  const hasValidStep1Fields = Boolean(
    houseNo.trim() && area.trim() && colony.trim() && /^\d{6}$/.test(pincode.trim())
  );
  const canContinueToDetails = hasValidStep1Fields;

  const prepareManualLocation = async () => {
    if (!houseNo.trim()) {
      setErrorMsg('House No. is required');
      return false;
    }
    if (!area || !colony) {
      setErrorMsg('Please select both area and colony');
      return false;
    }
    if (!/^\d{6}$/.test(pincode.trim())) {
      setErrorMsg('Please enter a valid 6-digit pincode');
      return false;
    }
    setErrorMsg('');
    const trimmed = composedAddress.trim();
    setAddress(trimmed);
    const coords = await forwardGeocode(trimmed);
    if (coords) {
      setLocation({ latitude: coords.lat, longitude: coords.lng });
    } else {
      setLocation(null);
    }
    return true;
  };

  const handleContinueToDetails = async () => {
    if (!location) {
      const ok = await prepareManualLocation();
      if (!ok) return;
    }
    setStep(2);
  };

  const handleAddRoom = () => {
    setRooms([
      ...rooms,
      createEmptyRoom(),
    ]);
    setRoomPhotoUrls((prev) => [...prev, createEmptyRoomImages()]);
    setRoomPhotoFiles((prev) => [...prev, createEmptyRoomFiles()]);
  };

  const handleRemoveRoom = (id: string) => {
    if (rooms.length === 1) return; // Must have at least 1 room
    const removeIndex = rooms.findIndex((r) => r.id === id);
    if (removeIndex === -1) return;
    setRooms(rooms.filter(r => r.id !== id));
    setRoomPhotoUrls((prev) => prev.filter((_, index) => index !== removeIndex));
    setRoomPhotoFiles((prev) => prev.filter((_, index) => index !== removeIndex));
  };

  const updateRoom = <K extends keyof RoomDetails>(
    id: string,
    field: K,
    value: RoomDetails[K]
  ) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const digitsOnly = (value: string) => value.replace(/\D/g, '');
  const toOptionalNumber = (value: string): number | '' => {
    const sanitized = digitsOnly(value);
    return sanitized ? parseInt(sanitized, 10) : '';
  };
  const toBoundedOptionalNumber = (
    value: string,
    min: number,
    max: number
  ): number | '' => {
    const parsed = toOptionalNumber(value);
    if (parsed === '') return '';
    return Math.min(max, Math.max(min, parsed));
  };

  const handleFileInput = async (
    event: React.ChangeEvent<HTMLInputElement>,
    slot: UploadSlot
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (slot === 'exterior') {
      setExteriorPhotoFile(file);
      setExteriorPhotoUrl(URL.createObjectURL(file));
      event.target.value = '';
      return;
    }

    const match = /^room-(\d+)-(\d+)$/.exec(slot);
    if (!match) {
      event.target.value = '';
      return;
    }
    const roomIndex = Number(match[1]);
    const imageIndex = Number(match[2]);
    if (!Number.isFinite(roomIndex) || !Number.isFinite(imageIndex)) {
      event.target.value = '';
      return;
    }

    setRoomPhotoFiles((prev) =>
      prev.map((roomImages, i) =>
        i === roomIndex ? roomImages.map((value, j) => (j === imageIndex ? file : value)) : roomImages
      )
    );
    setRoomPhotoUrls((prev) =>
      prev.map((roomImages, i) =>
        i === roomIndex
          ? roomImages.map((value, j) => (j === imageIndex ? URL.createObjectURL(file) : value))
          : roomImages
      )
    );
    event.target.value = '';
  };

  const handleSubmit = async () => {
    const finalAddress = address.trim() || composedAddress.trim();

    if (!houseNo.trim() || !area.trim() || !colony.trim() || !/^\d{6}$/.test(pincode.trim())) {
      setErrorMsg('Please fill all location fields correctly (Landmark is optional)');
      return;
    }

    if (!location && !finalAddress) {
      setErrorMsg('Address is required');
      return;
    }

    for (let roomIndex = 0; roomIndex < rooms.length; roomIndex += 1) {
      const room = rooms[roomIndex];
      if (!room) continue;

      if (room.propertyTypeId === '') {
        setErrorMsg(`Room ${roomIndex + 1}: Property Type is required`);
        return;
      }
      if (room.floorLevelId === '') {
        setErrorMsg(`Room ${roomIndex + 1}: Floor Level is required`);
        return;
      }
      if (room.maxOccupants === '') {
        setErrorMsg(`Room ${roomIndex + 1}: Max Occupants is required`);
        return;
      }
      if (room.furnishingTypeId === '') {
        setErrorMsg(`Room ${roomIndex + 1}: Furnishing is required`);
        return;
      }
      const isIndividual = room.propertyTypeId === 2;
      if (!isIndividual && room.foodPreferenceId === '') {
        setErrorMsg(`Room ${roomIndex + 1}: Food Preference is required`);
        return;
      }
      if (!isIndividual && room.foodLevelId === '') {
        setErrorMsg(`Room ${roomIndex + 1}: Food Level is required`);
        return;
      }
      if (room.bedType === '') {
        setErrorMsg(`Room ${roomIndex + 1}: Bed Type is required`);
        return;
      }
      if (room.bedType === 'Single' || room.bedType === 'Mixed') {
        if (room.singleBedCount === '') {
          setErrorMsg(`Room ${roomIndex + 1}: Single Bed Count is required`);
          return;
        }
      }
      if (room.bedType === 'Double' || room.bedType === 'Mixed') {
        if (room.doubleBedCount === '') {
          setErrorMsg(`Room ${roomIndex + 1}: Double Bed Count is required`);
          return;
        }
      }
      if (room.securityDeposit === '') {
        setErrorMsg(`Room ${roomIndex + 1}: Security Deposit is required`);
        return;
      }
      if (!room.availableFrom.trim()) {
        setErrorMsg(`Room ${roomIndex + 1}: Available From is required`);
        return;
      }
      if (!room.description.trim()) {
        setErrorMsg(`Room ${roomIndex + 1}: Description is required`);
        return;
      }
      if (room.monthlyRent === '' || room.monthlyRent <= 0) {
        setErrorMsg(`Room ${roomIndex + 1}: Monthly Rent is required`);
        return;
      }

      const hasRoomImage = (roomPhotoUrls[roomIndex] || []).some((url) => url.trim().length > 0);
      if (!hasRoomImage) {
        setErrorMsg(`Room ${roomIndex + 1}: at least one room image is required`);
        return;
      }
    }

    if (!exteriorPhotoUrl.trim()) {
      setErrorMsg('Exterior image is required');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // Format payload correctly (stripping UI-only ids)
      const payloadRooms: RoomPayload[] = rooms.map((room) => {
        const roomPayload: RoomPayload = {
          floorLevelId: Number(room.floorLevelId),
          maxOccupants: Number(room.maxOccupants),
          foodPreferenceId: room.propertyTypeId === 2 ? 3 : Number(room.foodPreferenceId),
          allowSmoking: room.allowSmoking,
          monthlyRent: Number(room.monthlyRent),
          furnishingTypeId: Number(room.furnishingTypeId),
          availableFrom: room.availableFrom.slice(0, 10),
          description: room.description,
          securityDeposit: Number(room.securityDeposit),
          propertyTypeId: Number(room.propertyTypeId),
          foodLevelId: room.propertyTypeId === 2 ? 1 : Number(room.foodLevelId),
          bedType: room.bedType,
          singleBedCount:
            room.bedType === 'Single' || room.bedType === 'Mixed'
              ? Number(room.singleBedCount)
              : 0,
          doubleBedCount:
            room.bedType === 'Double' || room.bedType === 'Mixed'
              ? Number(room.doubleBedCount)
              : 0,
        };
        return roomPayload as RoomPayload;
      });
      const normalizeUrl = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed || trimmed.startsWith("blob:")) return "";
        return trimmed;
      };

      const formData = new FormData();
      formData.append(
        "data",
        JSON.stringify({
          location,
          address: finalAddress,
          rooms: payloadRooms,
          exteriorPhotoUrl: exteriorPhotoFile ? "" : normalizeUrl(exteriorPhotoUrl),
          roomPhotoUrls: roomPhotoUrls.map((roomImages, roomIndex) =>
            roomImages.map((url, imageIndex) => {
              if (roomPhotoFiles[roomIndex]?.[imageIndex]) return "";
              return normalizeUrl(url);
            })
          ),
        })
      );

      if (exteriorPhotoFile) {
        formData.append("exteriorFile", exteriorPhotoFile);
      }

      for (let roomIndex = 0; roomIndex < roomPhotoFiles.length; roomIndex += 1) {
        for (let imageIndex = 0; imageIndex < IMAGES_PER_ROOM; imageIndex += 1) {
          const file = roomPhotoFiles[roomIndex]?.[imageIndex];
          if (!file) continue;
          formData.append(`roomFile-${roomIndex}-${imageIndex}`, file);
        }
      }

      await apiFetch('/api/listings/submit', {
        method: 'POST',
        body: formData,
      });

      setStep(3);
      showToast('Listing posted successfully', 'success');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        navigate("/login");
        return;
      }
      setErrorMsg(err instanceof Error ? err.message : "Failed to submit listing");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="add-listing-container">
        <div className="add-listing-header">
          <h1>Post Your Property</h1>
          <p className="add-listing-subtitle">
            {step === 1 && "Let's start with your property location"}
            {step === 2 && "Tell us about your property details"}
            {step === 3 && "Your property is now live!"}
          </p>
          <div className="step-indicator">
            <div className={`step-dot ${step >= 1 ? 'active' : ''}`}></div>
            <div className={`step-dot ${step >= 2 ? 'active' : ''}`}></div>
            <div className={`step-dot ${step >= 3 ? 'active' : ''}`}></div>
          </div>
        </div>
      
      {/* STEP 1: LOCATION */}
      {step === 1 && (
        <div className="glass-card location-step-card">
          <h2 className="text-center">Where is your property located?</h2>
          <p className="mb-4 text-center">We'll precisely pinpoint your location to help tenants find you easily.</p>

          <div className="flex-col location-form">
            <div className="location-fields-grid">
              <div className="form-group">
                <label>House No.</label>
                <input
                  className="input-style"
                  placeholder="e.g. 24/7"
                  value={houseNo}
                  onChange={(e) => setHouseNo(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Landmark (Optional)</label>
                <input
                  className="input-style"
                  placeholder="e.g. Near SBI Bank"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Area</label>
                <select
                  className="input-style"
                  value={area}
                  onChange={(e) => {
                    const selectedArea = e.target.value;
                    setArea(selectedArea);
                    const validColonies = areaToColonies[selectedArea] ?? [];
                    if (!validColonies.includes(colony)) {
                      setColony('');
                    }
                  }}
                  required
                >
                  <option value="" disabled>Select area</option>
                  {areaOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              </div>
              <div className="form-group">
                <label>Colony</label>
                <select
                  className="input-style"
                  value={colony}
                  onChange={(e) => setColony(e.target.value)}
                  disabled={!area}
                  required
                >
                  <option value="" disabled>{area ? 'Select colony' : 'Select area first'}</option>
                  {colonyOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Pincode</label>
                <input
                  type="text"
                  className="input-style"
                  placeholder="e.g. 302017"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                />
              
            </div>
          </div>
          
          {errorMsg && <p className="mt-4 text-center add-listing-error">{errorMsg}</p>}

          <div className="text-center mt-4">
            <button
              type="button"
              className="btn btn-primary publish-btn"
              disabled={!canContinueToDetails}
              onClick={() => void handleContinueToDetails()}
            >
              Continue to Room Details
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: ROOM DETAILS */}
      {step === 2 && (
        <>
          <div className="mb-4 flex-row justify-between room-toolbar">
            <h2>Room Details</h2>
            <button className="btn btn-outline" onClick={handleAddRoom}>
              <Plus size={18} /> Add Another Room
            </button>
          </div>

          <div className="flex-col">
            {rooms.map((room, index) => (
              <div key={room.id} className="glass-card room-card">
                {rooms.length > 1 && (
                  <button 
                    onClick={() => handleRemoveRoom(room.id)}
                    className="btn btn-outline room-remove-btn"
                    aria-label="Remove room"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                
                <h3 className="mb-4">Room {index + 1}</h3>
                
                <div className="room-grid">

                  <div className="form-group">
                    <label>Property Type</label>
                    <select
                      className="input-style"
                      value={room.propertyTypeId}
                      onChange={(e) => updateRoom(room.id, 'propertyTypeId', e.target.value ? parseInt(e.target.value, 10) : '')}
                    >
                      <option value="" disabled>Select property type</option>
                      <option value={1}>PG</option>
                      <option value={2}>Individual</option>
                      <option value={3}>Flat</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Floor Level</label>
                    <select 
                      className="input-style"
                      value={room.floorLevelId}
                      onChange={(e) => updateRoom(room.id, 'floorLevelId', e.target.value ? parseInt(e.target.value, 10) : '')}
                    >
                      <option value="" disabled>Select floor</option>
                      <option value={1}>Ground Floor</option>
                      <option value={2}>1st Floor</option>
                      <option value={3}>2nd Floor</option>
                      <option value={4}>3rd Floor</option>
                      <option value={5}>Roof</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Max Occupants</label>
                    <select 
                      className="input-style"
                      value={room.maxOccupants}
                      onChange={(e) => updateRoom(room.id, 'maxOccupants', e.target.value ? parseInt(e.target.value, 10) : '')}
                    >
                      <option value="" disabled>Select max occupants</option>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Monthly Rent (₹)</label>
                    <input 
                      type="text"
                      className="input-style"
                      value={room.monthlyRent}
                      onChange={(e) =>
                        updateRoom(room.id, 'monthlyRent', toOptionalNumber(e.target.value))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Furnishing</label>
                    <select 
                      className="input-style"
                      value={room.furnishingTypeId}
                      onChange={(e) => updateRoom(room.id, 'furnishingTypeId', e.target.value ? parseInt(e.target.value, 10) : '')}
                    >
                      <option value="" disabled>Select furnishing</option>
                      <option value={1}>Unfurnished</option>
                      <option value={2}>Semi-Furnished</option>
                      <option value={3}>Fully-Furnished</option>
                    </select>
                  </div>

                  {room.propertyTypeId !== 2 && (
                    <div className="form-group">
                      <label>Food Preference</label>
                      <select 
                        className="input-style"
                        value={room.foodPreferenceId}
                        onChange={(e) => updateRoom(room.id, 'foodPreferenceId', e.target.value ? parseInt(e.target.value, 10) : '')}
                      >
                        <option value="" disabled>Select food preference</option>
                        <option value={1}>Veg Only</option>
                        <option value={2}>Non-Veg Allowed</option>
                        <option value={3}>No Restriction</option>
                      </select>
                    </div>
                  )}

                  {room.propertyTypeId !== 2 && (
                    <div className="form-group">
                      <label>Food Level</label>
                      <select
                        className="input-style"
                        value={room.foodLevelId}
                        onChange={(e) => updateRoom(room.id, 'foodLevelId', e.target.value ? parseInt(e.target.value, 10) : '')}
                      >
                        <option value="" disabled>Select food level</option>
                        <option value={1}>Basic</option>
                        <option value={2}>Standard</option>
                        <option value={3}>Premium</option>
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Bed Type</label>
                    <select
                      className="input-style"
                      value={room.bedType}
                      onChange={(e) => {
                        const nextType = e.target.value as 'Single' | 'Double' | 'Mixed' | '';
                        setRooms((prev) =>
                          prev.map((item) =>
                            item.id === room.id
                              ? {
                                  ...item,
                                  bedType: nextType,
                                  singleBedCount:
                                    nextType === 'Single' || nextType === 'Mixed'
                                      ? item.singleBedCount
                                      : '',
                                  doubleBedCount:
                                    nextType === 'Double' || nextType === 'Mixed'
                                      ? item.doubleBedCount
                                      : '',
                                }
                              : item
                          )
                        );
                      }}
                    >
                      <option value="" disabled>Select bed type</option>
                      <option value="Single">Single Bed</option>
                      <option value="Double">Double Bed</option>
                      <option value="Mixed">Mixed (Single + Double)</option>
                    </select>
                  </div>

                  {(room.bedType === 'Single' || room.bedType === 'Mixed') && (
                    <div className="form-group">
                      <label>Single Bed Count</label>
                      <input
                        type="text"
                        className="input-style"
                        value={room.singleBedCount}
                        onChange={(e) =>
                          updateRoom(
                            room.id,
                            'singleBedCount',
                            toBoundedOptionalNumber(e.target.value, 0, 10)
                          )
                        }
                      />
                    </div>
                  )}

                  {(room.bedType === 'Double' || room.bedType === 'Mixed') && (
                    <div className="form-group">
                      <label>Double Bed Count</label>
                      <input
                        type="text"
                        className="input-style"
                        value={room.doubleBedCount}
                        onChange={(e) =>
                          updateRoom(
                            room.id,
                            'doubleBedCount',
                            toBoundedOptionalNumber(e.target.value, 0, 10)
                          )
                        }
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label>Available From (Date & Time)</label>
                    <input 
                      type="datetime-local"
                      className="input-style"
                      value={room.availableFrom}
                      onChange={(e) => updateRoom(room.id, 'availableFrom', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Security Deposit (₹)</label>
                    <input
                      type="text"
                      className="input-style"
                      value={room.securityDeposit}
                      onChange={(e) =>
                        updateRoom(room.id, 'securityDeposit', toOptionalNumber(e.target.value))
                      }
                    />
                  </div>

                  <div className="form-group room-span-full">
                    <label>Description</label>
                    <textarea
                      className="input-style"
                      rows={3}
                      value={room.description}
                      onChange={(e) => updateRoom(room.id, 'description', e.target.value)}
                      placeholder="Add highlights of this property"
                    />
                  </div>

                  <div className="form-group room-span-full">
                    <label>Room Images (up to 3)</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                      {Array.from({ length: IMAGES_PER_ROOM }, (_, imageIndex) => {
                        const slot = `room-${index}-${imageIndex}` as UploadSlot;
                        const imageUrl = roomPhotoUrls[index]?.[imageIndex] || '';
                        return (
                          <div
                            key={slot}
                            style={{
                              flex: '1 1 260px',
                              minWidth: '240px',
                              maxWidth: '360px',
                              border: '1px solid var(--border-color)',
                              borderRadius: '12px',
                              padding: '0.75rem',
                              background: 'var(--bg-card)',
                            }}
                          >
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                              Image {imageIndex + 1}
                            </label>
                            <div className="flex-row image-upload-actions">
                              <label className="btn btn-outline image-upload-btn">
                                Upload File
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => void handleFileInput(e, slot)}
                                  className="hidden-input"
                                />
                              </label>
                            </div>
                            {imageUrl.trim() && (
                              <img
                                src={imageUrl}
                                alt={`Room ${index + 1} image ${imageIndex + 1} preview`}
                                className="image-preview"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="form-group room-span-full">
                    <label className="checkbox-group">
                      <input 
                        type="checkbox" 
                        checked={room.allowSmoking}
                        onChange={(e) => updateRoom(room.id, 'allowSmoking', e.target.checked)}
                      />
                      Smoking Allowed
                    </label>
                  </div>
                </div>
              </div>
            ))}

            <div className="glass-card">
              <h3 className="mb-4">Property Images</h3>
              <p className="mb-4">Add an exterior image. Room images are attached inside each room card.</p>
              <div className="flex-col">
                <div className="form-group">
                  <label>Exterior Image</label>
                  <div className="flex-row image-upload-actions">
                    <label className="btn btn-outline image-upload-btn">
                      Upload File
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => void handleFileInput(e, 'exterior')}
                        className="hidden-input"
                      />
                    </label>
                   
                  </div>
                  {exteriorPhotoUrl.trim() && (
                    <img
                      src={exteriorPhotoUrl}
                      alt="Exterior preview"
                      className="image-preview"
                    />
                  )}
                </div>
              </div>
            </div>

            {errorMsg && <p className="text-center add-listing-error">{errorMsg}</p>}

            <div className="text-center mt-4 publish-wrap">
              <button 
                className="btn btn-primary publish-btn" 
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Publishing...' : <><Send size={18} /> Publish Listing</>}
              </button>
            </div>
          </div>
        </>
      )}

      {/* STEP 3: SUCCESS */}
      {step === 3 && (
        <div className="glass-card text-center success-card">
          <CheckCircle2 color="#10b981" size={72} className="success-icon" />
          <h2>Successfully Published!</h2>
          <p className="mb-4">Your property is now active and visible to potential tenants.</p>
          <div className="success-actions">
            <button className="btn btn-primary" onClick={() => navigate('/listings')}>
              View All Listings
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/profile')}>
              Go to Profile
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

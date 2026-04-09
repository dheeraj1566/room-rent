import { useMemo, useState } from 'react';
import { MapPin, Plus, Trash2, Send, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../../lib/api';
import Navbar from '../../components/Navbar';
import GoogleLocationPickerMap from '../../components/GoogleLocationPickerMap';
import {
  forwardGeocode,
  reverseGeocode,
  type Coordinates,
} from '../../lib/googleMaps';

interface LocationState {
  latitude: number;
  longitude: number;
}

interface RoomDetails {
  id: string; // for React keys
  floorLevelId: number;
  maxOccupants: number;
  foodPreferenceId: number;
  allowSmoking: boolean;
  monthlyRent: number;
  furnishingTypeId: number;
  availableFrom: string;
  description: string;
  securityDeposit: number;
  propertyTypeId: number;
  foodLevelId: number;
  bedType: 'Single' | 'Double' | 'Mixed';
  singleBedCount: number;
  doubleBedCount: number;
}
type RoomPayload = Omit<RoomDetails, 'id'>;
type ListingPhoto = {
  photoType: 'Exterior' | 'Room';
  photoUrl: string;
  blobId?: string;
  displayOrder?: number;
};

type UploadSlot = 'exterior' | `room-${number}-${number}`;

const DEFAULT_COORDS = { latitude: 26.9124, longitude: 75.7873 };
const IMAGES_PER_ROOM = 3;
const createEmptyRoomImages = () => Array.from({ length: IMAGES_PER_ROOM }, () => '');

export default function AddListing() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Location, 2: Rooms, 3: Success
  const [location, setLocation] = useState<LocationState | null>(null);
  const [address, setAddress] = useState<string>('');
  const [isLocating, setIsLocating] = useState(false);
  const [resolvingMapLocation, setResolvingMapLocation] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exteriorPhotoUrl, setExteriorPhotoUrl] = useState('');
  const [exteriorBlobId, setExteriorBlobId] = useState('');
  const [roomPhotoUrls, setRoomPhotoUrls] = useState<string[][]>([createEmptyRoomImages()]);
  const [roomBlobIds, setRoomBlobIds] = useState<string[][]>([createEmptyRoomImages()]);
  const [uploadingSlot, setUploadingSlot] = useState<UploadSlot | null>(null);
  
  const [rooms, setRooms] = useState<RoomDetails[]>([
    {
      id: crypto.randomUUID(),
      floorLevelId: 1,
      maxOccupants: 1,
      foodPreferenceId: 3,
      allowSmoking: false,
      monthlyRent: 5000,
      furnishingTypeId: 1,
      availableFrom: new Date().toISOString().split('T')[0],
      description: '',
      securityDeposit: 0,
      propertyTypeId: 1,
      foodLevelId: 1,
      bedType: 'Single',
      singleBedCount: 1,
      doubleBedCount: 0,
    }
  ]);

  const mapCenter = useMemo<Coordinates>(() => {
    if (!location) return { lat: DEFAULT_COORDS.latitude, lng: DEFAULT_COORDS.longitude };
    return { lat: location.latitude, lng: location.longitude };
  }, [location]);

  const canContinueToDetails = Boolean(location || address.trim().length > 5);

  const applyLocationFromMap = async (coords: Coordinates) => {
    setLocation({ latitude: coords.lat, longitude: coords.lng });
    setResolvingMapLocation(true);
    setErrorMsg('');
    try {
      const exactAddress = await reverseGeocode(coords.lat, coords.lng);
      setAddress(exactAddress);
    } catch {
      setAddress(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
    } finally {
      setResolvingMapLocation(false);
    }
  };

  const handleFetchLocation = () => {
    setIsLocating(true);
    setErrorMsg('');
    
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setLocation(nextLocation);
        try {
          const exactAddress = await reverseGeocode(nextLocation.latitude, nextLocation.longitude);
          setAddress(exactAddress);
        } catch {
          setAddress(`${nextLocation.latitude.toFixed(6)}, ${nextLocation.longitude.toFixed(6)}`);
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error(error);
        setErrorMsg('Failed to fetch location. Please ensure you have granted location permissions.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleManualLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = address.trim();
    if (trimmed.length <= 5) {
      setErrorMsg('Please enter a full, valid address');
      return;
    }
    setErrorMsg('');
    const coords = await forwardGeocode(trimmed);
    if (coords) {
      setLocation({ latitude: coords.lat, longitude: coords.lng });
    } else {
      setLocation(null);
    }
  };

  const handleAddRoom = () => {
    setRooms([
      ...rooms,
      {
        id: crypto.randomUUID(),
        floorLevelId: 1,
        maxOccupants: 1,
        foodPreferenceId: 3,
        allowSmoking: false,
        monthlyRent: 5000,
        furnishingTypeId: 1,
        availableFrom: new Date().toISOString().split('T')[0],
        description: '',
        securityDeposit: 0,
        propertyTypeId: 1,
        foodLevelId: 1,
        bedType: 'Single',
        singleBedCount: 1,
        doubleBedCount: 0,
      }
    ]);
    setRoomPhotoUrls((prev) => [...prev, createEmptyRoomImages()]);
    setRoomBlobIds((prev) => [...prev, createEmptyRoomImages()]);
  };

  const handleRemoveRoom = (id: string) => {
    if (rooms.length === 1) return; // Must have at least 1 room
    const removeIndex = rooms.findIndex((r) => r.id === id);
    if (removeIndex === -1) return;
    setRooms(rooms.filter(r => r.id !== id));
    setRoomPhotoUrls((prev) => prev.filter((_, index) => index !== removeIndex));
    setRoomBlobIds((prev) => prev.filter((_, index) => index !== removeIndex));
  };

  const updateRoom = <K extends keyof RoomDetails>(
    id: string,
    field: K,
    value: RoomDetails[K]
  ) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const digitsOnly = (value: string) => value.replace(/\D/g, '');
  const toNumberOr = (value: string, fallback: number) => {
    const sanitized = digitsOnly(value);
    return sanitized ? parseInt(sanitized, 10) : fallback;
  };
  const toBoundedNumber = (
    value: string,
    min: number,
    max: number,
    fallback: number
  ) => Math.min(max, Math.max(min, toNumberOr(value, fallback)));

  const uploadImageForSlot = async (file: File, slot: UploadSlot) => {
    try {
      setErrorMsg('');
      setUploadingSlot(slot);
      const formData = new FormData();
      formData.append('image', file);

      const response = await apiFetch<{ url: string; blobId: string }>('/api/uploads/image', {
        method: 'POST',
        body: formData,
      });

      if (slot === 'exterior') {
        setExteriorPhotoUrl(response.url);
        setExteriorBlobId(response.blobId);
        return;
      }

      const match = /^room-(\d+)-(\d+)$/.exec(slot);
      if (!match) return;
      const roomIndex = Number(match[1]);
      const imageIndex = Number(match[2]);
      if (!Number.isFinite(roomIndex) || !Number.isFinite(imageIndex)) return;
      if (roomIndex < 0 || imageIndex < 0 || imageIndex >= IMAGES_PER_ROOM) return;

      setRoomPhotoUrls((prev) =>
        prev.map((roomImages, i) =>
          i === roomIndex ? roomImages.map((value, j) => (j === imageIndex ? response.url : value)) : roomImages
        )
      );
      setRoomBlobIds((prev) =>
        prev.map((roomImages, i) =>
          i === roomIndex
            ? roomImages.map((value, j) => (j === imageIndex ? response.blobId : value))
            : roomImages
        )
      );
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        navigate('/login');
        return;
      }
      setErrorMsg(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleFileInput = async (
    event: React.ChangeEvent<HTMLInputElement>,
    slot: UploadSlot
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadImageForSlot(file, slot);
    event.target.value = '';
  };

  const handleSubmit = async () => {
    if (!location && !address) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // Format payload correctly (stripping UI-only ids)
      const payloadRooms: RoomPayload[] = rooms.map((room) => {
        const roomPayload = { ...room } as Partial<RoomDetails>;
        delete roomPayload.id;
        return roomPayload as RoomPayload;
      });
      const isBulk = payloadRooms.length > 1;

      const buildPhotosForRoom = (roomIndex: number): ListingPhoto[] => {
        const photos: ListingPhoto[] = [];
        if (exteriorPhotoUrl.trim()) {
          photos.push({
            photoType: 'Exterior',
            photoUrl: exteriorPhotoUrl.trim(),
            ...(exteriorBlobId ? { blobId: exteriorBlobId } : {}),
          });
        }
        const roomImages = roomPhotoUrls[roomIndex] || [];
        const roomImageBlobIds = roomBlobIds[roomIndex] || [];
        for (let imageIndex = 0; imageIndex < IMAGES_PER_ROOM; imageIndex += 1) {
          const roomPhotoUrl = (roomImages[imageIndex] || '').trim();
          if (!roomPhotoUrl) continue;
          photos.push({
            photoType: 'Room',
            photoUrl: roomPhotoUrl,
            ...(roomImageBlobIds[imageIndex] ? { blobId: roomImageBlobIds[imageIndex] } : {}),
            displayOrder: photos.length + 1,
          });
        }
        return photos;
      };

      if (!isBulk) {
        await apiFetch('/api/listings', {
          method: 'POST',
          body: JSON.stringify({
            location,
            address,
            room: payloadRooms[0],
            photos: buildPhotosForRoom(0),
          }),
        });
      } else {
        const hasAnyPhotos =
          exteriorPhotoUrl.trim().length > 0 ||
          roomPhotoUrls.some((roomImages) => roomImages.some((url) => url.trim()));

        if (!hasAnyPhotos) {
          await apiFetch('/api/listings/bulk', {
            method: 'POST',
            body: JSON.stringify({ location, address, rooms: payloadRooms }),
          });
        } else {
          for (let index = 0; index < payloadRooms.length; index += 1) {
            await apiFetch('/api/listings', {
              method: 'POST',
              body: JSON.stringify({
                location,
                address,
                room: payloadRooms[index],
                photos: buildPhotosForRoom(index),
              }),
            });
          }
        }
      }

      setStep(3);
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
          
          <div className="text-center mb-4">
            <button 
              className="btn btn-primary" 
              onClick={handleFetchLocation}
              disabled={isLocating || resolvingMapLocation}
            >
              <MapPin size={20} />
              {isLocating ? 'Locating...' : resolvingMapLocation ? 'Updating...' : 'Fetch My Location'}
            </button>
          </div>

          <div className="divider-or">
            <div className="divider-line"></div>
            <span>OR ENTER MANUALLY</span>
            <div className="divider-line"></div>
          </div>

          <form onSubmit={handleManualLocation} className="flex-col location-form">
            <div className="form-group">
              <label>Full Property Address</label>
              <textarea 
                className="input-style" 
                placeholder="e.g. Plot No 24, Near SBI Bank, Malviya Nagar, Jaipur, Rajasthan 302017"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                required 
              />
            </div>
            <button type="submit" className="btn btn-outline w-full">
              Confirm Address
            </button>
          </form>
          
          {errorMsg && <p className="mt-4 text-center add-listing-error">{errorMsg}</p>}

          <div className="map-preview-card">
            <h3>Location Preview</h3>
            <GoogleLocationPickerMap
              center={mapCenter}
              onSelect={(coords) => void applyLocationFromMap(coords)}
              className="map-preview-frame"
            />
            <p className="profile-map-help">
              Click on map or drag the marker to update the property location.
            </p>
          </div>

          <div className="text-center mt-4">
            <button
              type="button"
              className="btn btn-primary publish-btn"
              disabled={!canContinueToDetails || isLocating || resolvingMapLocation}
              onClick={() => setStep(2)}
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
                      onChange={(e) => updateRoom(room.id, 'propertyTypeId', parseInt(e.target.value))}
                    >
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
                      onChange={(e) => updateRoom(room.id, 'floorLevelId', parseInt(e.target.value))}
                    >
                      <option value={1}>Ground Floor</option>
                      <option value={2}>1st Floor</option>
                      <option value={3}>2nd Floor</option>
                      <option value={4}>3rd Floor</option>
                      <option value={5}>Roof</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Max Occupants</label>
                    <input 
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="input-style"
                      value={room.maxOccupants}
                      onChange={(e) =>
                        updateRoom(
                          room.id,
                          'maxOccupants',
                          toBoundedNumber(e.target.value, 1, 4, 1)
                        )
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Monthly Rent (₹)</label>
                    <input 
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="input-style"
                      value={room.monthlyRent}
                      onChange={(e) =>
                        updateRoom(room.id, 'monthlyRent', toNumberOr(e.target.value, 0))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Furnishing</label>
                    <select 
                      className="input-style"
                      value={room.furnishingTypeId}
                      onChange={(e) => updateRoom(room.id, 'furnishingTypeId', parseInt(e.target.value))}
                    >
                      <option value={1}>Unfurnished</option>
                      <option value={2}>Semi-Furnished</option>
                      <option value={3}>Fully-Furnished</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Food Preference</label>
                    <select 
                      className="input-style"
                      value={room.foodPreferenceId}
                      onChange={(e) => updateRoom(room.id, 'foodPreferenceId', parseInt(e.target.value))}
                    >
                      <option value={1}>Veg Only</option>
                      <option value={2}>Non-Veg Allowed</option>
                      <option value={3}>No Restriction</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Food Level</label>
                    <select
                      className="input-style"
                      value={room.foodLevelId}
                      onChange={(e) => updateRoom(room.id, 'foodLevelId', parseInt(e.target.value))}
                    >
                      <option value={1}>Basic</option>
                      <option value={2}>Standard</option>
                      <option value={3}>Premium</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Bed Type</label>
                    <select
                      className="input-style"
                      value={room.bedType}
                      onChange={(e) => updateRoom(room.id, 'bedType', e.target.value as 'Single' | 'Double' | 'Mixed')}
                    >
                      <option value="Single">Single Bed</option>
                      <option value="Double">Double Bed</option>
                      <option value="Mixed">Mixed (Single + Double)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Single Bed Count</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="input-style"
                      value={room.singleBedCount}
                      onChange={(e) =>
                        updateRoom(
                          room.id,
                          'singleBedCount',
                          toBoundedNumber(e.target.value, 0, 10, 0)
                        )
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Double Bed Count</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="input-style"
                      value={room.doubleBedCount}
                      onChange={(e) =>
                        updateRoom(
                          room.id,
                          'doubleBedCount',
                          toBoundedNumber(e.target.value, 0, 10, 0)
                        )
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Available From</label>
                    <input 
                      type="date"
                      className="input-style"
                      value={room.availableFrom}
                      onChange={(e) => updateRoom(room.id, 'availableFrom', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Security Deposit (₹)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="input-style"
                      value={room.securityDeposit}
                      onChange={(e) =>
                        updateRoom(room.id, 'securityDeposit', toNumberOr(e.target.value, 0))
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
                            <input
                              type="url"
                              className="input-style"
                              value={imageUrl}
                              onChange={(e) => {
                                setRoomPhotoUrls((prev) =>
                                  prev.map((roomImages, roomIdx) =>
                                    roomIdx === index
                                      ? roomImages.map((value, imgIdx) =>
                                          imgIdx === imageIndex ? e.target.value : value
                                        )
                                      : roomImages
                                  )
                                );
                                setRoomBlobIds((prev) =>
                                  prev.map((roomImages, roomIdx) =>
                                    roomIdx === index
                                      ? roomImages.map((value, imgIdx) =>
                                          imgIdx === imageIndex ? '' : value
                                        )
                                      : roomImages
                                  )
                                );
                              }}
                              placeholder="https://example.com/room.jpg"
                            />
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
                            {uploadingSlot === slot && <p>Uploading room image...</p>}
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
                  <label>Exterior Image URL</label>
                  <input
                    type="url"
                    className="input-style"
                    value={exteriorPhotoUrl}
                    onChange={(e) => {
                      setExteriorPhotoUrl(e.target.value);
                      setExteriorBlobId('');
                    }}
                    placeholder="https://example.com/exterior.jpg"
                  />
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
                  {uploadingSlot === 'exterior' && <p>Uploading exterior image...</p>}
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

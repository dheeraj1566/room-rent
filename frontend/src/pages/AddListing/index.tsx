import { useState } from 'react';
import { MapPin, Plus, Trash2, Send, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../../lib/api';
import Navbar from '../../components/Navbar';

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

type UploadSlot = 'exterior' | 'room-0' | 'room-1';

export default function AddListing() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Location, 2: Rooms, 3: Success
  const [location, setLocation] = useState<LocationState | null>(null);
  const [address, setAddress] = useState<string>('');
  const [isLocating, setIsLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [exteriorPhotoUrl, setExteriorPhotoUrl] = useState('');
  const [exteriorBlobId, setExteriorBlobId] = useState('');
  const [roomPhotoUrls, setRoomPhotoUrls] = useState<string[]>(['', '']);
  const [roomBlobIds, setRoomBlobIds] = useState<string[]>(['', '']);
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

  const handleFetchLocation = () => {
    setIsLocating(true);
    setErrorMsg('');
    
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Fetch My Location coordinates:', {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setAddress(''); // Clear plain english address
        setIsLocating(false);
        setStep(2);
      },
      (error) => {
        console.error(error);
        setErrorMsg('Failed to fetch location. Please ensure you have granted location permissions.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleManualLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (address.trim().length > 5) {
      setLocation(null); // Clear coords to rely strictly on address forward-geocoding
      setStep(2);
    } else {
      setErrorMsg('Please enter a full, valid address');
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
  };

  const handleRemoveRoom = (id: string) => {
    if (rooms.length === 1) return; // Must have at least 1 room
    setRooms(rooms.filter(r => r.id !== id));
  };

  const updateRoom = (id: string, field: keyof RoomDetails, value: any) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

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

      const index = slot === 'room-0' ? 0 : 1;
      setRoomPhotoUrls((prev) => prev.map((value, i) => (i === index ? response.url : value)));
      setRoomBlobIds((prev) => prev.map((value, i) => (i === index ? response.blobId : value)));
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
      const payloadRooms = rooms.map(({ id, ...rest }) => rest);
      const photos = [
        ...(exteriorPhotoUrl.trim()
          ? [
              {
                photoType: 'Exterior',
                photoUrl: exteriorPhotoUrl.trim(),
                ...(exteriorBlobId ? { blobId: exteriorBlobId } : {}),
              },
            ]
          : []),
        ...roomPhotoUrls
          .map((url, index) => ({ url, index }))
          .filter(({ url }) => url.trim())
          .slice(0, 2)
          .map(({ url, index }) => ({
            photoType: 'Room',
            photoUrl: url.trim(),
            ...(roomBlobIds[index] ? { blobId: roomBlobIds[index] } : {}),
            displayOrder: index + 1,
          })),
      ];
      
      const isBulk = payloadRooms.length > 1;
      const path = `/api/listings${isBulk ? '/bulk' : ''}`;

      if (isBulk && photos.length > 0) {
        setErrorMsg('Image upload is supported for single listing only. Remove extra rooms or photos.');
        setIsSubmitting(false);
        return;
      }
      
      const body = isBulk 
        ? { location, address, rooms: payloadRooms }
        : { location, address, room: payloadRooms[0], photos };

      await apiFetch(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });

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
          <p style={{ color: 'var(--text-muted)', fontSize: '1.0625rem' }}>
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
        <div className="glass-card text-center text-left">
          <h2 className="text-center">Where is your property located?</h2>
          <p className="mb-4 text-center">We'll precisely pinpoint your location to help tenants find you easily.</p>
          
          <div className="text-center mb-4">
            <button 
              className="btn btn-primary" 
              onClick={handleFetchLocation}
              disabled={isLocating}
            >
              <MapPin size={20} />
              {isLocating ? 'Locating...' : 'Fetch My Location'}
            </button>
          </div>

          <div style={{ margin: '2rem 0', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
            <span style={{ padding: '0 1rem', fontSize: '0.9rem' }}>OR ENTER MANUALLY</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
          </div>

          <form onSubmit={handleManualLocation} className="flex-col" style={{ maxWidth: '400px', margin: '0 auto' }}>
            <div className="form-group" style={{ textAlign: 'left' }}>
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
            <button type="submit" className="btn btn-outline" style={{ width: '100%' }}>
              Confirm Address
            </button>
          </form>
          
          {errorMsg && <p className="mt-4 text-center" style={{ color: '#ef4444' }}>{errorMsg}</p>}
        </div>
      )}

      {/* STEP 2: ROOM DETAILS */}
      {step === 2 && (
        <>
          <div className="mb-4 flex-row justify-between">
            <h2>Room Details</h2>
            <button className="btn btn-outline" onClick={handleAddRoom}>
              <Plus size={18} /> Add Another Room
            </button>
          </div>

          <div className="flex-col">
            {rooms.map((room, index) => (
              <div key={room.id} className="glass-card" style={{ position: 'relative' }}>
                {rooms.length > 1 && (
                  <button 
                    onClick={() => handleRemoveRoom(room.id)}
                    className="btn btn-danger"
                    style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', padding: '0.5rem' }}
                    aria-label="Remove room"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                
                <h3 className="mb-4">Room {index + 1}</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

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
                      type="number" min="1" max="4"
                      className="input-style"
                      value={room.maxOccupants}
                      onChange={(e) => updateRoom(room.id, 'maxOccupants', parseInt(e.target.value))}
                    />
                  </div>

                  <div className="form-group">
                    <label>Monthly Rent (₹)</label>
                    <input 
                      type="number" min="0" step="500"
                      className="input-style"
                      value={room.monthlyRent}
                      onChange={(e) => updateRoom(room.id, 'monthlyRent', parseInt(e.target.value))}
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
                      type="number" min="0" max="10"
                      className="input-style"
                      value={room.singleBedCount}
                      onChange={(e) => updateRoom(room.id, 'singleBedCount', parseInt(e.target.value || '0'))}
                    />
                  </div>

                  <div className="form-group">
                    <label>Double Bed Count</label>
                    <input
                      type="number" min="0" max="10"
                      className="input-style"
                      value={room.doubleBedCount}
                      onChange={(e) => updateRoom(room.id, 'doubleBedCount', parseInt(e.target.value || '0'))}
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
                      type="number" min="0" step="500"
                      className="input-style"
                      value={room.securityDeposit}
                      onChange={(e) => updateRoom(room.id, 'securityDeposit', parseInt(e.target.value || '0'))}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Description</label>
                    <textarea
                      className="input-style"
                      rows={3}
                      value={room.description}
                      onChange={(e) => updateRoom(room.id, 'description', e.target.value)}
                      placeholder="Add highlights of this property"
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
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
              <p className="mb-4">Upload from device, capture from camera, or paste image URL.</p>
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
                  <div className="flex-row">
                    <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
                      Upload File
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => void handleFileInput(e, 'exterior')}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
                      Capture Photo
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => void handleFileInput(e, 'exterior')}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                  {uploadingSlot === 'exterior' && <p>Uploading exterior image...</p>}
                  {exteriorPhotoUrl.trim() && (
                    <img
                      src={exteriorPhotoUrl}
                      alt="Exterior preview"
                      style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '10px', marginTop: '0.5rem' }}
                    />
                  )}
                </div>
                {roomPhotoUrls.map((url, index) => (
                  <div key={index} className="form-group">
                    <label>Room Image URL {index + 1}</label>
                    <input
                      type="url"
                      className="input-style"
                      value={url}
                      onChange={(e) =>
                        {
                          setRoomPhotoUrls((prev) =>
                            prev.map((item, i) => (i === index ? e.target.value : item))
                          );
                          setRoomBlobIds((prev) =>
                            prev.map((item, i) => (i === index ? '' : item))
                          );
                        }
                      }
                      placeholder="https://example.com/room.jpg"
                    />
                    <div className="flex-row">
                      <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
                        Upload File
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => void handleFileInput(e, index === 0 ? 'room-0' : 'room-1')}
                          style={{ display: 'none' }}
                        />
                      </label>
                      <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
                        Capture Photo
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => void handleFileInput(e, index === 0 ? 'room-0' : 'room-1')}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                    {uploadingSlot === (index === 0 ? 'room-0' : 'room-1') && <p>Uploading room image...</p>}
                    {url.trim() && (
                      <img
                        src={url}
                        alt={`Room ${index + 1} preview`}
                        style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '10px', marginTop: '0.5rem' }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {errorMsg && <p className="text-center" style={{ color: '#ef4444' }}>{errorMsg}</p>}

            <div className="text-center mt-4">
              <button 
                className="btn btn-primary" 
                style={{ width: '200px' }}
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
        <div className="glass-card text-center" style={{ padding: '3rem 2rem' }}>
          <CheckCircle2 color="#10b981" size={72} style={{ margin: '0 auto 1.5rem' }} />
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>Successfully Published!</h2>
          <p className="mb-4" style={{ fontSize: '1.0625rem' }}>Your property is now active and visible to potential tenants.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
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

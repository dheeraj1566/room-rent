import mongoose, { Schema, type Document } from "mongoose";

// Embedded photo sub-document
export interface IListingPhoto {
  photoType: "Room" | "Exterior";
  photoUrl: string;
  blobId?: string;
  displayOrder: number;
  uploadedAt: Date;
}

export interface IRentTier {
  occupants: number;
  rent: number;
}

export interface IListing extends Document {
  _id: mongoose.Types.ObjectId;
  landlordId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  floorLevel: string;
  furnishingType: string;
  maxOccupants: number;
  allowSmoking: boolean;
  foodPreference: string;
  coolingType?: string;
  propertyType?: string;
  foodLevel?: number;
  bedType?: "Single" | "Double" | "Mixed";
  singleBedCount?: number;
  doubleBedCount?: number;
  roomFor?: "Male" | "Female" | "Any";
  monthlyRent: number;
  rentTiers?: IRentTier[];
  securityDeposit?: number;
  availableFrom: Date;
  addressLine: string;
  colony: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  location: { type: "Point"; coordinates: [number, number] };
  status: string;
  isActive: boolean;
  photos: IListingPhoto[];
  createdAt: Date;
  updatedAt: Date;
}

const listingPhotoSchema = new Schema<IListingPhoto>(
  {
    photoType: { type: String, enum: ["Room", "Exterior"], required: true },
    photoUrl: { type: String, required: true },
    blobId: { type: String },
    displayOrder: { type: Number, default: 1 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const rentTierSchema = new Schema<IRentTier>(
  {
    occupants: { type: Number, required: true },
    rent: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const listingSchema = new Schema<IListing>(
  {
    landlordId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    floorLevel: { type: String, required: true },
    furnishingType: { type: String, required: true },
    maxOccupants: { type: Number, required: true, min: 1, max: 4 },
    allowSmoking: { type: Boolean, default: false },
    foodPreference: { type: String, required: true },
    coolingType: { type: String, enum: ["AC", "Non-AC", "Cooler"] },
    propertyType: { type: String, enum: ["PG", "Individual", "Flat"] },
    foodLevel: { type: Number },
    bedType: { type: String, enum: ["Single", "Double", "Mixed"] },
    singleBedCount: { type: Number },
    doubleBedCount: { type: Number },
    roomFor: { type: String, enum: ["Male", "Female", "Any"] },
    monthlyRent: { type: Number, required: true, min: 0 },
    rentTiers: { type: [rentTierSchema], default: undefined },
    securityDeposit: { type: Number },
    availableFrom: { type: Date, required: true },
    addressLine: { type: String, required: true, trim: true },
    colony: { type: String, required: true, trim: true },
    city: { type: String, required: true, default: "Jaipur", trim: true },
    state: { type: String, required: true, default: "Rajasthan", trim: true },
    pincode: { type: String, required: true, trim: true },
    landmark: { type: String, trim: true },
    location: {
      type: { type: String, enum: ["Point"], required: true },
      coordinates: { type: [Number], required: true },
    },
    status: {
      type: String,
      enum: ["Active", "Paused", "Rented", "Expired", "Deleted"],
      default: "Active",
    },
    isActive: { type: Boolean, default: true, index: true },
    photos: [listingPhotoSchema],
  },
  {
    timestamps: true,
  }
);

// Indexes
listingSchema.index({ landlordId: 1, status: 1 });
listingSchema.index({ status: 1, createdAt: -1 });
listingSchema.index({ colony: 1, status: 1 });
listingSchema.index({ monthlyRent: 1, status: 1 });
listingSchema.index({ maxOccupants: 1, status: 1 });
listingSchema.index({ availableFrom: 1, status: 1 });
listingSchema.index({ location: "2dsphere" });
// Text index for search
listingSchema.index(
  { title: "text", description: "text", colony: "text", city: "text", addressLine: "text" },
  { name: "listings_text_search" }
);

export const Listing = mongoose.model<IListing>("Listing", listingSchema);
export default Listing;

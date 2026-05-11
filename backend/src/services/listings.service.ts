import type { ParsedAddress } from "./googleMaps.service";
import { BlobService, generateReadSasUrl } from "./blob.service.js";
import Listing, { type IListing, type IListingPhoto, type IRentTier } from "../models/Listing.js";
import Location from "../models/Location.js";
import {
  FLOOR_LEVELS,
  FURNISHING_TYPES,
  FOOD_PREFERENCES,
  PROPERTY_TYPES,
  COOLING_TYPES,
  PROJECT_STATUS_TYPES,
  ROOM_CATEGORIES,
  LISTING_STATUSES_BY_NAME,
  FLOOR_LEVELS_BY_NAME,
  FURNISHING_TYPES_BY_NAME,
  FOOD_PREFERENCES_BY_NAME,
  PROPERTY_TYPES_BY_NAME,
  COOLING_TYPES_BY_NAME,
  PROJECT_STATUS_TYPES_BY_NAME,
  ROOM_CATEGORIES_BY_NAME,
  resolveLookup,
} from "../constants/lookups.js";

export interface CreateListingDto {
  landlordId: string;
  roomDetails: {
    floorLevelId: number;
    maxOccupants: number;
    foodPreferenceId: number;
    allowSmoking: boolean;
    monthlyRent?: number;
    furnishingTypeId: number;
    coolingTypeId?: number;
    availableFrom: string;
    description?: string;
    securityDeposit?: number | null;
    propertyTypeId?: number;
    roomCategoryId?: number;
    foodLevelId?: number;
    bedType?: "Single" | "Double" | "Mixed";
    singleBedCount?: number;
    doubleBedCount?: number;
    rentTiers?: { occupants: number; rent: number }[];
    roomFor?: "Male" | "Female" | "Any";
  };
  photos?: {
    photoType: "Room" | "Exterior";
    photoUrl: string;
    blobId?: string;
    displayOrder?: number;
  }[];
  location: ParsedAddress & { latitude: number; longitude: number };
}

export interface UpdateListingDto {
  landlordId: string;
  listingId: string;
  roomDetails: CreateListingDto["roomDetails"];
  location: CreateListingDto["location"];
  photos?: CreateListingDto["photos"];
}

export interface RentTierItem {
  occupants: number;
  rent: number;
}

export interface ListingItem {
  listingId: string;
  landlordId: string;
  title: string;
  colony: string;
  city: string;
  monthlyRent: number;
  rentTiers: RentTierItem[];
  roomCategoryId: number;
  roomCategoryName: string;
  floorLevelId: number;
  furnishingTypeId: number;
  maxOccupants: number;
  allowSmoking: boolean;
  foodPreferenceId: number;
  coolingTypeId: number | null;
  propertyTypeId: number | null;
  projectStatusId: number | null;
  availableFrom: string;
  floorName: string;
  furnishingName: string;
  preferenceName: string;
  coolingTypeName: string | null;
  propertyTypeName: string | null;
  projectStatusName: string | null;
  statusId: number;
  statusName: string;
  landlordName: string;
  landlordGender: string | null;
  roomFor: string | null;
  coverPhotoUrl: string | null;
  createdAt: string;
}

export interface ListingPhotoItem {
  photoType: string;
  photoUrl: string;
  displayOrder: number;
}

export interface ListingDetailsItem {
  listingId: string;
  landlordId: string;
  title: string;
  description: string | null;
  roomCategoryId: number;
  roomCategoryName: string;
  floorLevelId: number;
  floorName: string;
  furnishingTypeId: number;
  furnishingName: string;
  maxOccupants: number;
  allowSmoking: boolean;
  foodPreferenceId: number;
  preferenceName: string;
  coolingTypeId: number | null;
  coolingTypeName: string | null;
  propertyTypeId: number | null;
  propertyTypeName: string | null;
  monthlyRent: number;
  rentTiers: RentTierItem[];
  securityDeposit: number | null;
  availableFrom: string;
  addressLine: string;
  colony: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string | null;
  latitude: number;
  longitude: number;
  statusId: number;
  statusName: string;
  landlordName: string;
  landlordGender: string | null;
  roomFor: string | null;
  bedType: string | null;
  singleBedCount: number | null;
  doubleBedCount: number | null;
  photos: ListingPhotoItem[];
  coverPhotoUrl: string | null;
  createdAt: string;
}

export interface ListingFilters {
  search?: string;
  city?: string;
  minRent?: number;
  maxRent?: number;
  maxOccupants?: number[];
  roomCategoryId?: number[];
  floorLevelId?: number[];
  furnishingTypeId?: number[];
  foodPreferenceId?: number[];
  coolingTypeId?: number[];
  propertyTypeId?: number[];
  projectStatusId?: number[];
  gender?: string[];
  allowSmoking?: boolean[];
  sortBy?: "rent_asc" | "rent_desc" | "newest";
  landlordId?: string;
}

export interface LocationOption {
  area: string;
  colonies: string[];
}

export class ListingsService {
  private static inferRoomCategory(
    roomCategory: string | undefined | null,
    maxOccupants: number,
    rentTiers?: { occupants: number; rent: number }[]
  ): "Single" | "Shared" | "Unshared" {
    const resolvedCategory = resolveLookup(ROOM_CATEGORIES, roomCategory ?? undefined);
    if (resolvedCategory === "Single" || resolvedCategory === "Shared" || resolvedCategory === "Unshared") {
      return resolvedCategory;
    }

    if (maxOccupants <= 1) return "Single";
    if (Array.isArray(rentTiers) && rentTiers.length > 1) return "Shared";
    return "Unshared";
  }

  private static normalizeRentTiers(rentTiers?: { occupants: number; rent: number }[]): IRentTier[] | undefined {
    if (!Array.isArray(rentTiers) || rentTiers.length === 0) return undefined;

    const normalized = rentTiers
      .filter((tier) => Number.isFinite(tier.occupants) && tier.occupants > 0 && Number.isFinite(tier.rent) && tier.rent >= 0)
      .map((tier) => ({
        occupants: Math.trunc(tier.occupants),
        rent: Math.trunc(tier.rent),
      }))
      .sort((a, b) => a.occupants - b.occupants);

    return normalized.length > 0 ? normalized : undefined;
  }

  private static resolveMonthlyRent(
    monthlyRent: number | undefined,
    maxOccupants: number,
    roomCategory: "Single" | "Shared" | "Unshared",
    rentTiers?: IRentTier[]
  ): number {
    if (Number.isFinite(monthlyRent)) return Number(monthlyRent);

    if (roomCategory === "Shared" && Array.isArray(rentTiers) && rentTiers.length > 0) {
      return rentTiers.find((tier) => tier.occupants === maxOccupants)?.rent ?? rentTiers[rentTiers.length - 1]!.rent;
    }

    return 0;
  }

  private static findCoverPhoto(photos: IListingPhoto[]): IListingPhoto | null {
    if (!photos || photos.length === 0) return null;
    return photos.find((p) => p.photoType === "Room") || photos[0] || null;
  }

  private static generateTitle(colony: string, furnishingTypeId: number): string {
    const fnTypeMap: Record<number, string> = {
      1: "Unfurnished",
      2: "Semi-Furnished",
      3: "Fully Furnished",
    };
    const fnLabel = fnTypeMap[furnishingTypeId] ?? "Room";
    return `${fnLabel} Room in ${colony}`;
  }

  // ─── Location Options ─────────────────────────────────────
  static async getLocationOptions(): Promise<LocationOption[]> {
    const locations = await Location.find({ isActive: true })
      .sort({ area: 1 })
      .lean();

    return locations.map((loc) => ({
      area: loc.area,
      colonies: [...loc.colonies].filter((c) => /[a-zA-Z]/.test(c)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),
    }));
  }

  // ─── Update Location Data ─────────────────────────────────
  static async updateLocationData(locationItems: { area: string; colonies: string[] }[]): Promise<{ 
    updated: number; 
    created: number; 
    total: number;
    errors: string[];
  }> {
    let updated = 0;
    let created = 0;
    const errors: string[] = [];

    for (const item of locationItems) {
      try {
        // Clean and validate colonies array
        const cleanColonies = item.colonies
          .filter((colony) => colony && typeof colony === 'string' && colony.trim().length > 0)
          .map((colony) => colony.trim())
          .filter((colony, index, arr) => arr.indexOf(colony) === index); // Remove duplicates

        // Try to find existing location
        const existingLocation = await Location.findOne({ area: item.area.trim() });
        
        if (existingLocation) {
          // Update existing location
          await Location.updateOne(
            { _id: existingLocation._id },
            {
              colonies: cleanColonies,
              isActive: true,
              updatedAt: new Date()
            }
          );
          updated++;
        } else {
          // Create new location
          await Location.create({
            area: item.area.trim(),
            colonies: cleanColonies,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          created++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to process area "${item.area}": ${errorMessage}`);
        console.error(`Location update error for ${item.area}:`, error);
      }
    }

    return {
      updated,
      created,
      total: locationItems.length,
      errors
    };
  }

  // ─── Create Single Listing ────────────────────────────────
  static async createSingleListing(data: CreateListingDto): Promise<string> {
    const title = this.generateTitle(data.location.colony, data.roomDetails.furnishingTypeId);
    const rentTiers = this.normalizeRentTiers(data.roomDetails.rentTiers);
    const roomCategory = this.inferRoomCategory(
      resolveLookup(ROOM_CATEGORIES, data.roomDetails.roomCategoryId) ?? undefined,
      data.roomDetails.maxOccupants,
      rentTiers
    );
    const monthlyRent = this.resolveMonthlyRent(
      data.roomDetails.monthlyRent,
      data.roomDetails.maxOccupants,
      roomCategory,
      rentTiers
    );

    // Build photos array
    const photos: IListingPhoto[] = [];
    if (Array.isArray(data.photos) && data.photos.length > 0) {
      for (const photo of data.photos) {
        let finalBlobId = photo.blobId;
        let finalUrl = photo.photoUrl;

        // We'll assign blobId after listing creation if needed
        photos.push({
          photoType: photo.photoType,
          photoUrl: finalUrl,
          blobId: finalBlobId,
          displayOrder: photo.displayOrder ?? photos.length + 1,
          uploadedAt: new Date(),
        } as IListingPhoto);
      }
    }

    const listing = await Listing.create({
      landlordId: data.landlordId,
      title,
      description: data.roomDetails.description ?? undefined,
      roomCategory,
      floorLevel: resolveLookup(FLOOR_LEVELS, data.roomDetails.floorLevelId) ?? "Ground Floor",
      furnishingType: resolveLookup(FURNISHING_TYPES, data.roomDetails.furnishingTypeId) ?? "Unfurnished",
      maxOccupants: data.roomDetails.maxOccupants,
      allowSmoking: data.roomDetails.allowSmoking,
      foodPreference: resolveLookup(FOOD_PREFERENCES, data.roomDetails.foodPreferenceId) ?? "No Restriction",
      coolingType: data.roomDetails.coolingTypeId
        ? (resolveLookup(COOLING_TYPES, data.roomDetails.coolingTypeId) ?? undefined)
        : undefined,
      propertyType: data.roomDetails.propertyTypeId
        ? (resolveLookup(PROPERTY_TYPES, data.roomDetails.propertyTypeId) ?? undefined)
        : undefined,
      foodLevel: data.roomDetails.foodLevelId ?? undefined,
      bedType: data.roomDetails.bedType ?? undefined,
      singleBedCount: data.roomDetails.singleBedCount ?? undefined,
      doubleBedCount: data.roomDetails.doubleBedCount ?? undefined,
      monthlyRent,
      rentTiers,
      securityDeposit: data.roomDetails.securityDeposit ?? undefined,
      roomFor: data.roomDetails.roomFor ?? undefined,
      availableFrom: new Date(data.roomDetails.availableFrom),
      addressLine: data.location.addressLine,
      colony: data.location.colony,
      city: data.location.city,
      state: data.location.state,
      pincode: data.location.pincode,
      location: {
        type: "Point" as const,
        coordinates: [data.location.longitude, data.location.latitude] as [number, number],
      },
      status: "Active",
      photos,
    });

    const listingId = String(listing._id);

    // Move blobs to listing folder if needed
    if (Array.isArray(data.photos) && data.photos.length > 0) {
      const listingDoc = await Listing.findById(listingId);
      if (listingDoc) {
        let updated = false;
        for (let i = 0; i < listingDoc.photos.length; i++) {
          const originalPhoto = data.photos[i];
          if (originalPhoto?.blobId) {
            const moved = await BlobService.moveBlobToListingFolder(
              originalPhoto.blobId,
              listingId
            );
            listingDoc.photos[i]!.blobId = moved.blobId;
            listingDoc.photos[i]!.photoUrl = moved.blobUrl;
            updated = true;
          }
        }
        if (updated) {
          await listingDoc.save();
        }
      }
    }

    return listingId;
  }

  // ─── Create Bulk Listings ─────────────────────────────────
  static async createBulkListings(
    landlordId: string,
    roomsData: CreateListingDto["roomDetails"][],
    location: CreateListingDto["location"]
  ): Promise<string[]> {
    const listingIds: string[] = [];

    for (const room of roomsData) {
      if (!room) continue;
      const title = this.generateTitle(location.colony, room.furnishingTypeId);
      const rentTiers = this.normalizeRentTiers(room.rentTiers);
      const roomCategory = this.inferRoomCategory(
        resolveLookup(ROOM_CATEGORIES, room.roomCategoryId) ?? undefined,
        room.maxOccupants,
        rentTiers
      );
      const monthlyRent = this.resolveMonthlyRent(room.monthlyRent, room.maxOccupants, roomCategory, rentTiers);

      const listing = await Listing.create({
        landlordId,
        title,
        description: room.description ?? undefined,
        roomCategory,
        floorLevel: resolveLookup(FLOOR_LEVELS, room.floorLevelId) ?? "Ground Floor",
        furnishingType: resolveLookup(FURNISHING_TYPES, room.furnishingTypeId) ?? "Unfurnished",
        maxOccupants: room.maxOccupants,
        allowSmoking: room.allowSmoking,
        foodPreference: resolveLookup(FOOD_PREFERENCES, room.foodPreferenceId) ?? "No Restriction",
        coolingType: room.coolingTypeId
          ? (resolveLookup(COOLING_TYPES, room.coolingTypeId) ?? undefined)
          : undefined,
        propertyType: room.propertyTypeId
          ? (resolveLookup(PROPERTY_TYPES, room.propertyTypeId) ?? undefined)
          : undefined,
        foodLevel: room.foodLevelId ?? undefined,
        bedType: room.bedType ?? undefined,
        singleBedCount: room.singleBedCount ?? undefined,
        doubleBedCount: room.doubleBedCount ?? undefined,
        monthlyRent,
        rentTiers,
        securityDeposit: room.securityDeposit ?? undefined,
        availableFrom: new Date(room.availableFrom),
        addressLine: location.addressLine,
        colony: location.colony,
        city: location.city,
        state: location.state,
        pincode: location.pincode,
        location: {
          type: "Point" as const,
          coordinates: [location.longitude, location.latitude] as [number, number],
        },
        status: "Active",
        photos: [],
      });

      listingIds.push(String(listing._id));
    }

    return listingIds;
  }

  // ─── Update Listing ───────────────────────────────────────
  static async updateListingById(data: UpdateListingDto): Promise<boolean> {
    const title = this.generateTitle(
      data.location.colony,
      data.roomDetails.furnishingTypeId
    );
    const rentTiers = this.normalizeRentTiers(data.roomDetails.rentTiers);
    const roomCategory = this.inferRoomCategory(
      resolveLookup(ROOM_CATEGORIES, data.roomDetails.roomCategoryId) ?? undefined,
      data.roomDetails.maxOccupants,
      rentTiers
    );
    const monthlyRent = this.resolveMonthlyRent(
      data.roomDetails.monthlyRent,
      data.roomDetails.maxOccupants,
      roomCategory,
      rentTiers
    );

    const updateFields: Record<string, unknown> = {
      title,
      description: data.roomDetails.description ?? null,
      roomCategory,
      floorLevel: resolveLookup(FLOOR_LEVELS, data.roomDetails.floorLevelId) ?? "Ground Floor",
      furnishingType: resolveLookup(FURNISHING_TYPES, data.roomDetails.furnishingTypeId) ?? "Unfurnished",
      maxOccupants: data.roomDetails.maxOccupants,
      allowSmoking: data.roomDetails.allowSmoking,
      foodPreference: resolveLookup(FOOD_PREFERENCES, data.roomDetails.foodPreferenceId) ?? "No Restriction",
      coolingType: data.roomDetails.coolingTypeId
        ? (resolveLookup(COOLING_TYPES, data.roomDetails.coolingTypeId) ?? undefined)
        : null,
      propertyType: data.roomDetails.propertyTypeId
        ? (resolveLookup(PROPERTY_TYPES, data.roomDetails.propertyTypeId) ?? undefined)
        : undefined,
      foodLevel: data.roomDetails.foodLevelId ?? null,
      bedType: data.roomDetails.bedType ?? null,
      singleBedCount: data.roomDetails.singleBedCount ?? null,
      doubleBedCount: data.roomDetails.doubleBedCount ?? null,
      monthlyRent,
      rentTiers: rentTiers ?? [],
      securityDeposit: data.roomDetails.securityDeposit ?? null,
      availableFrom: new Date(data.roomDetails.availableFrom),
      addressLine: data.location.addressLine,
      colony: data.location.colony,
      city: data.location.city,
      state: data.location.state,
      pincode: data.location.pincode,
      location: {
        type: "Point" as const,
        coordinates: [data.location.longitude, data.location.latitude] as [number, number],
      },
    };

    // Handle photos if provided
    if (Array.isArray(data.photos)) {
      const photos: IListingPhoto[] = [];
      for (const photo of data.photos) {
        let finalBlobId = photo.blobId;
        let finalUrl = photo.photoUrl;

        if (photo.blobId) {
          const moved = await BlobService.moveBlobToListingFolder(
            photo.blobId,
            data.listingId
          );
          finalBlobId = moved.blobId;
          finalUrl = moved.blobUrl;
        }

        photos.push({
          photoType: photo.photoType,
          photoUrl: finalUrl,
          blobId: finalBlobId,
          displayOrder: photo.displayOrder ?? photos.length + 1,
          uploadedAt: new Date(),
        } as IListingPhoto);
      }
      updateFields.photos = photos;
    }

    const result = await Listing.updateOne(
      { _id: data.listingId, landlordId: data.landlordId },
      { $set: updateFields }
    );

    return (result.matchedCount ?? 0) > 0;
  }

  // ─── Toggle Listing Visibility (Active ↔ Paused) ─────────
  static async toggleListingStatus(listingId: string, landlordId: string): Promise<string | null> {
    const listing = await Listing.findOne({ _id: listingId, landlordId, isActive: true });
    if (!listing) return null;
    const newStatus = listing.status === "Active" ? "Paused" : "Active";
    await Listing.updateOne({ _id: listingId, landlordId }, { $set: { status: newStatus } });
    return newStatus;
  }

  // ─── Soft Delete Listing ──────────────────────────────────
  static async deleteListingById(listingId: string, landlordId: string): Promise<boolean> {
    const result = await Listing.updateOne(
      { _id: listingId, landlordId, isActive: true },
      { $set: { isActive: false } }
    );
    return (result.matchedCount ?? 0) > 0;
  }

  // ─── Get All Listings ─────────────────────────────────────
  static async getAllListings(
    page: number,
    limit: number,
    filters: ListingFilters = {}
  ): Promise<{ items: ListingItem[]; total: number }> {
    const offset = (page - 1) * limit;

    // Build filter query
    // When viewing own listings, include all statuses (Active + Paused)
    const query: Record<string, unknown> = filters.landlordId
      ? { isActive: true }
      : { status: "Active", isActive: true };

    // Search
    if (filters.search && filters.search.trim()) {
      const keywords = filters.search
        .trim()
        .split(/\s+/)
        .filter((k) => k.length > 0);
      if (keywords.length > 0) {
        const regexConditions = keywords.map((keyword) => ({
          $or: [
            { title: { $regex: keyword, $options: "i" } },
            { colony: { $regex: keyword, $options: "i" } },
            { city: { $regex: keyword, $options: "i" } },
            { addressLine: { $regex: keyword, $options: "i" } },
            { description: { $regex: keyword, $options: "i" } },
            { floorLevel: { $regex: keyword, $options: "i" } },
            { furnishingType: { $regex: keyword, $options: "i" } },
            { foodPreference: { $regex: keyword, $options: "i" } },
            { coolingType: { $regex: keyword, $options: "i" } },
          ],
        }));
        query.$and = regexConditions;
      }
    }

    if (filters.city && filters.city.trim()) {
      query.city = { $regex: filters.city.trim(), $options: "i" };
    }

    if (typeof filters.minRent === "number" && Number.isFinite(filters.minRent)) {
      query.monthlyRent = { ...(query.monthlyRent as object || {}), $gte: filters.minRent };
    }

    if (typeof filters.maxRent === "number" && Number.isFinite(filters.maxRent)) {
      query.monthlyRent = { ...(query.monthlyRent as object || {}), $lte: filters.maxRent };
    }

    if (filters.maxOccupants && filters.maxOccupants.length > 0) {
      query.maxOccupants = { $in: filters.maxOccupants };
    }

    if (filters.roomCategoryId && filters.roomCategoryId.length > 0) {
      const roomCategories = filters.roomCategoryId
        .map((id) => resolveLookup(ROOM_CATEGORIES, id))
        .filter(Boolean);
      if (roomCategories.length > 0) query.roomCategory = { $in: roomCategories };
    }

    if (filters.floorLevelId && filters.floorLevelId.length > 0) {
      const floorNames = filters.floorLevelId
        .map((id) => resolveLookup(FLOOR_LEVELS, id))
        .filter(Boolean);
      if (floorNames.length > 0) query.floorLevel = { $in: floorNames };
    }

    if (filters.furnishingTypeId && filters.furnishingTypeId.length > 0) {
      const furnishingNames = filters.furnishingTypeId
        .map((id) => resolveLookup(FURNISHING_TYPES, id))
        .filter(Boolean);
      if (furnishingNames.length > 0) query.furnishingType = { $in: furnishingNames };
    }

    if (filters.foodPreferenceId && filters.foodPreferenceId.length > 0) {
      const foodNames = filters.foodPreferenceId
        .map((id) => resolveLookup(FOOD_PREFERENCES, id))
        .filter(Boolean);
      if (foodNames.length > 0) query.foodPreference = { $in: foodNames };
    }

    if (filters.coolingTypeId && filters.coolingTypeId.length > 0) {
      const coolingNames = filters.coolingTypeId
        .map((id) => resolveLookup(COOLING_TYPES, id))
        .filter(Boolean);
      if (coolingNames.length > 0) query.coolingType = { $in: coolingNames };
    }

    if (filters.propertyTypeId && filters.propertyTypeId.length > 0) {
      const propertyNames = filters.propertyTypeId
        .map((id) => resolveLookup(PROPERTY_TYPES, id))
        .filter(Boolean);
      if (propertyNames.length > 0) query.propertyType = { $in: propertyNames };
    }

    if (filters.projectStatusId && filters.projectStatusId.length > 0) {
      const statusNames = filters.projectStatusId
        .map((id) => resolveLookup(PROJECT_STATUS_TYPES, id))
        .filter(Boolean);
      if (statusNames.length > 0) query.projectStatus = { $in: statusNames };
    }

    if (filters.allowSmoking && filters.allowSmoking.length > 0) {
      query.allowSmoking = { $in: filters.allowSmoking };
    }

    if (filters.landlordId) {
      query.landlordId = filters.landlordId;
    }

    // Sort
    let sort: Record<string, 1 | -1> = { createdAt: -1 };
    if (filters.sortBy === "rent_asc") sort = { monthlyRent: 1 };
    else if (filters.sortBy === "rent_desc") sort = { monthlyRent: -1 };

    // Execute query with populate
    const [listings, total] = await Promise.all([
      Listing.find(query)
        .populate("landlordId", "fullName")
        .sort(sort)
        .skip(offset)
        .limit(limit)
        .lean(),
      Listing.countDocuments(query),
    ]);

    // Room-for filter (stored directly on the listing)
    let filteredListings = listings;
    if (filters.gender && filters.gender.length > 0) {
      const normalizedGenders = filters.gender
        .map((g) => g.trim().toLowerCase())
        .filter((g) => g === "male" || g === "female" || g === "any");

      if (normalizedGenders.length > 0) {
        filteredListings = listings.filter((listing) => {
          const rf = (listing.roomFor ?? "any").toLowerCase();
          return rf === "any" || normalizedGenders.includes(rf as "male" | "female" | "any");
        });
      }
    }

    const items: ListingItem[] = filteredListings.map((listing) => {
      const landlord = listing.landlordId as unknown as { _id: unknown; fullName?: string };
      const coverPhoto = this.findCoverPhoto((listing.photos as IListingPhoto[]) || []);
      const roomCategory = this.inferRoomCategory(
        listing.roomCategory,
        listing.maxOccupants,
        listing.rentTiers as IRentTier[] | undefined
      );

      return {
        listingId: String(listing._id),
        landlordId: String(landlord?._id ?? listing.landlordId),
        title: listing.title,
        colony: listing.colony,
        city: listing.city,
        monthlyRent: listing.monthlyRent,
        roomCategoryId: ROOM_CATEGORIES_BY_NAME[roomCategory] ?? 3,
        roomCategoryName: roomCategory,
        floorLevelId: FLOOR_LEVELS_BY_NAME[listing.floorLevel] ?? 0,
        furnishingTypeId: FURNISHING_TYPES_BY_NAME[listing.furnishingType] ?? 0,
        maxOccupants: listing.maxOccupants,
        allowSmoking: listing.allowSmoking,
        foodPreferenceId: FOOD_PREFERENCES_BY_NAME[listing.foodPreference] ?? 0,
        coolingTypeId: listing.coolingType
          ? (COOLING_TYPES_BY_NAME[listing.coolingType] ?? null)
          : null,
        propertyTypeId: listing.propertyType
          ? (PROPERTY_TYPES_BY_NAME[listing.propertyType] ?? null)
          : null,
        projectStatusId: listing.projectStatus
          ? (PROJECT_STATUS_TYPES_BY_NAME[listing.projectStatus] ?? null)
          : null,
        availableFrom: listing.availableFrom?.toISOString().split("T")[0] ?? "",
        floorName: listing.floorLevel,
        furnishingName: listing.furnishingType,
        preferenceName: listing.foodPreference,
        coolingTypeName: listing.coolingType ?? null,
        propertyTypeName: listing.propertyType ?? null,
        projectStatusName: listing.projectStatus ?? null,
        statusId: LISTING_STATUSES_BY_NAME[listing.status] ?? 1,
        statusName: listing.status,
        landlordName: landlord?.fullName ?? "",
        landlordGender: null,
        roomFor: listing.roomFor ?? null,
        coverPhotoUrl: coverPhoto?.photoUrl ?? null,
        rentTiers: (listing.rentTiers as IRentTier[] | undefined ?? []).map((t) => ({ occupants: t.occupants, rent: t.rent })),
        createdAt: listing.createdAt?.toISOString() ?? "",
      };
    });

    return { items, total };
  }

  // ─── Get Listing By ID ────────────────────────────────────
  static async getListingById(listingId: string): Promise<ListingDetailsItem | null> {
    const listing = await Listing.findById(listingId)
      .populate("landlordId", "fullName")
      .lean();

    if (!listing) return null;

    const landlord = listing.landlordId as unknown as { _id: unknown; fullName?: string };
    const photos: ListingPhotoItem[] = (listing.photos || []).map((p) => ({
      photoType: p.photoType,
      photoUrl: p.photoUrl,
      displayOrder: p.displayOrder,
    }));

    // Sort photos: exterior first, then by displayOrder
    photos.sort((a, b) => {
      if (a.photoType !== b.photoType) return a.photoType === "Exterior" ? -1 : 1;
      return a.displayOrder - b.displayOrder;
    });

    const coverPhoto = this.findCoverPhoto(listing.photos as IListingPhoto[]);
    const roomCategory = this.inferRoomCategory(
      listing.roomCategory,
      listing.maxOccupants,
      listing.rentTiers as IRentTier[] | undefined
    );

    return {
      listingId: String(listing._id),
      landlordId: String(landlord?._id ?? listing.landlordId),
      title: listing.title,
      description: listing.description ?? null,
      roomCategoryId: ROOM_CATEGORIES_BY_NAME[roomCategory] ?? 3,
      roomCategoryName: roomCategory,
      floorLevelId: FLOOR_LEVELS_BY_NAME[listing.floorLevel] ?? 0,
      floorName: listing.floorLevel,
      furnishingTypeId: FURNISHING_TYPES_BY_NAME[listing.furnishingType] ?? 0,
      furnishingName: listing.furnishingType,
      maxOccupants: listing.maxOccupants,
      allowSmoking: listing.allowSmoking,
      foodPreferenceId: FOOD_PREFERENCES_BY_NAME[listing.foodPreference] ?? 0,
      preferenceName: listing.foodPreference,
      coolingTypeId: listing.coolingType
        ? (COOLING_TYPES_BY_NAME[listing.coolingType] ?? null)
        : null,
      coolingTypeName: listing.coolingType ?? null,
      propertyTypeId: listing.propertyType
        ? (PROPERTY_TYPES_BY_NAME[listing.propertyType] ?? null)
        : null,
      propertyTypeName: listing.propertyType ?? null,
      monthlyRent: listing.monthlyRent,
      rentTiers: (listing.rentTiers as IRentTier[] | undefined ?? []).map((t) => ({ occupants: t.occupants, rent: t.rent })),
      securityDeposit: listing.securityDeposit ?? null,
      availableFrom: listing.availableFrom?.toISOString().split("T")[0] ?? "",
      addressLine: listing.addressLine,
      colony: listing.colony,
      city: listing.city,
      state: listing.state,
      pincode: listing.pincode,
      landmark: listing.landmark ?? null,
      latitude: listing.location?.coordinates?.[1] ?? 0,
      longitude: listing.location?.coordinates?.[0] ?? 0,
      statusId: LISTING_STATUSES_BY_NAME[listing.status] ?? 1,
      statusName: listing.status,
      landlordName: landlord?.fullName ?? "",
      landlordGender: null,
      roomFor: listing.roomFor ?? null,
      bedType: listing.bedType ?? null,
      singleBedCount: listing.singleBedCount ?? null,
      doubleBedCount: listing.doubleBedCount ?? null,
      photos,
      coverPhotoUrl: coverPhoto?.photoUrl ?? null,
      createdAt: listing.createdAt?.toISOString() ?? "",
    };
  }
}

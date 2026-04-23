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
  LISTING_STATUSES_BY_NAME,
  FLOOR_LEVELS_BY_NAME,
  FURNISHING_TYPES_BY_NAME,
  FOOD_PREFERENCES_BY_NAME,
  PROPERTY_TYPES_BY_NAME,
  COOLING_TYPES_BY_NAME,
  resolveLookup,
} from "../constants/lookups.js";

export interface CreateListingDto {
  landlordId: string;
  roomDetails: {
    floorLevelId: number;
    maxOccupants: number;
    foodPreferenceId: number;
    allowSmoking: boolean;
    monthlyRent: number;
    furnishingTypeId: number;
    coolingTypeId?: number;
    availableFrom: string;
    description?: string;
    securityDeposit?: number | null;
    propertyTypeId?: number;
    foodLevelId?: number;
    bedType?: "Single" | "Double" | "Mixed";
    singleBedCount?: number;
    doubleBedCount?: number;
    rentTiers?: { occupants: number; rent: number }[];
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
  floorLevelId: number;
  furnishingTypeId: number;
  maxOccupants: number;
  allowSmoking: boolean;
  foodPreferenceId: number;
  coolingTypeId: number | null;
  propertyTypeId: number | null;
  availableFrom: string;
  floorName: string;
  furnishingName: string;
  preferenceName: string;
  coolingTypeName: string | null;
  propertyTypeName: string | null;
  statusId: number;
  statusName: string;
  landlordName: string;
  landlordGender: string | null;
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
  floorLevelId?: number[];
  furnishingTypeId?: number[];
  foodPreferenceId?: number[];
  coolingTypeId?: number[];
  propertyTypeId?: number[];
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
  /**
   * Converts a Mongoose listing document to the API response format
   */
  private static toListingItem(
    doc: IListing & { landlordName?: string; landlordGender?: string | null }
  ): ListingItem {
    const coverPhoto = this.findCoverPhoto(doc.photos || []);

    return {
      listingId: String(doc._id),
      landlordId: String(doc.landlordId),
      title: doc.title,
      colony: doc.colony,
      city: doc.city,
      monthlyRent: doc.monthlyRent,
      floorLevelId: FLOOR_LEVELS_BY_NAME[doc.floorLevel] ?? 0,
      furnishingTypeId: FURNISHING_TYPES_BY_NAME[doc.furnishingType] ?? 0,
      maxOccupants: doc.maxOccupants,
      allowSmoking: doc.allowSmoking,
      foodPreferenceId: FOOD_PREFERENCES_BY_NAME[doc.foodPreference] ?? 0,
      coolingTypeId: doc.coolingType ? (COOLING_TYPES_BY_NAME[doc.coolingType] ?? null) : null,
      propertyTypeId: doc.propertyType ? (PROPERTY_TYPES_BY_NAME[doc.propertyType] ?? null) : null,
      availableFrom: doc.availableFrom?.toISOString().split("T")[0] ?? "",
      floorName: doc.floorLevel,
      furnishingName: doc.furnishingType,
      preferenceName: doc.foodPreference,
      coolingTypeName: doc.coolingType ?? null,
      propertyTypeName: doc.propertyType ?? null,
      statusId: LISTING_STATUSES_BY_NAME[doc.status] ?? 1,
      statusName: doc.status,
      landlordName: doc.landlordName ?? "",
      landlordGender: doc.landlordGender ?? null,
      coverPhotoUrl: coverPhoto?.photoUrl ?? null,
      rentTiers: (doc.rentTiers ?? []).map((t) => ({ occupants: t.occupants, rent: t.rent })),
      createdAt: doc.createdAt?.toISOString() ?? "",
    };
  }

  private static findCoverPhoto(photos: IListingPhoto[]): IListingPhoto | null {
    if (!photos || photos.length === 0) return null;
    // Prefer exterior, then room
    return photos.find((p) => p.photoType === "Exterior") || photos[0] || null;
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

  // ─── Create Single Listing ────────────────────────────────
  static async createSingleListing(data: CreateListingDto): Promise<string> {
    const title = this.generateTitle(data.location.colony, data.roomDetails.furnishingTypeId);

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
      monthlyRent: data.roomDetails.monthlyRent,
      rentTiers: Array.isArray(data.roomDetails.rentTiers) && data.roomDetails.rentTiers.length > 0
        ? data.roomDetails.rentTiers
        : undefined,
      securityDeposit: data.roomDetails.securityDeposit ?? undefined,
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

      const listing = await Listing.create({
        landlordId,
        title,
        description: room.description ?? undefined,
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
        monthlyRent: room.monthlyRent,
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

    const updateFields: Record<string, unknown> = {
      title,
      description: data.roomDetails.description ?? null,
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
      monthlyRent: data.roomDetails.monthlyRent,
      rentTiers: Array.isArray(data.roomDetails.rentTiers) && data.roomDetails.rentTiers.length > 0
        ? data.roomDetails.rentTiers
        : [],
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
    const query: Record<string, unknown> = { status: "Active", isActive: true };

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
        .populate("landlordId", "fullName gender")
        .sort(sort)
        .skip(offset)
        .limit(limit)
        .lean(),
      Listing.countDocuments(query),
    ]);

    // Gender filter (post-query since it's on the populated user)
    let filteredListings = listings;
    if (filters.gender && filters.gender.length > 0) {
      const normalizedGenders = filters.gender
        .map((g) => g.trim().toLowerCase())
        .filter((g) => g === "male" || g === "female" || g === "other")
        .map((g): "Male" | "Female" | "Other" => {
          if (g === "male") return "Male";
          if (g === "female") return "Female";
          return "Other";
        });

      if (normalizedGenders.length > 0) {
        filteredListings = listings.filter((listing) => {
          const landlord = listing.landlordId as unknown as { fullName?: string; gender?: string };
          return !!(landlord?.gender && normalizedGenders.includes(landlord.gender as "Male" | "Female" | "Other"));
        });
      }
    }

    const items: ListingItem[] = filteredListings.map((listing) => {
      const landlord = listing.landlordId as unknown as { _id: unknown; fullName?: string; gender?: string };
      const coverPhoto = this.findCoverPhoto((listing.photos as IListingPhoto[]) || []);

      return {
        listingId: String(listing._id),
        landlordId: String(landlord?._id ?? listing.landlordId),
        title: listing.title,
        colony: listing.colony,
        city: listing.city,
        monthlyRent: listing.monthlyRent,
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
        availableFrom: listing.availableFrom?.toISOString().split("T")[0] ?? "",
        floorName: listing.floorLevel,
        furnishingName: listing.furnishingType,
        preferenceName: listing.foodPreference,
        coolingTypeName: listing.coolingType ?? null,
        propertyTypeName: listing.propertyType ?? null,
        statusId: LISTING_STATUSES_BY_NAME[listing.status] ?? 1,
        statusName: listing.status,
        landlordName: landlord?.fullName ?? "",
        landlordGender: landlord?.gender ?? null,
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
      .populate("landlordId", "fullName gender")
      .lean();

    if (!listing) return null;

    const landlord = listing.landlordId as unknown as { _id: unknown; fullName?: string; gender?: string };
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

    return {
      listingId: String(listing._id),
      landlordId: String(landlord?._id ?? listing.landlordId),
      title: listing.title,
      description: listing.description ?? null,
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
      landlordGender: landlord?.gender ?? null,
      bedType: listing.bedType ?? null,
      singleBedCount: listing.singleBedCount ?? null,
      doubleBedCount: listing.doubleBedCount ?? null,
      photos,
      coverPhotoUrl: coverPhoto?.photoUrl ?? null,
      createdAt: listing.createdAt?.toISOString() ?? "",
    };
  }
}

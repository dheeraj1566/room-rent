import type { Request, Response, NextFunction } from "express";
import { GoogleMapsService } from "../services/googleMaps.service";
import { ListingsService } from "../services/listings.service";
import { BlobService } from "../services/blob.service.js";

const hasValidCoords = (coords?: { latitude?: number; longitude?: number }): coords is { latitude: number; longitude: number } =>
  Number.isFinite(coords?.latitude) && Number.isFinite(coords?.longitude);

const resolveFullLocation = async (
  coords?: { latitude?: number; longitude?: number },
  address?: string
) => {
  if (hasValidCoords(coords)) {
    try {
      const parsedAddress = await GoogleMapsService.reverseGeocode(coords.latitude, coords.longitude);
      return {
        ...parsedAddress,
        latitude: coords.latitude,
        longitude: coords.longitude,
      };
    } catch {
      // Fallback to forward geocode if address is provided.
      if (address && address.trim()) {
        const forwardData = await GoogleMapsService.forwardGeocode(address.trim());
        return {
          ...forwardData.parsed,
          latitude: forwardData.latitude,
          longitude: forwardData.longitude,
        };
      }
      return null;
    }
  }

  if (address && address.trim()) {
    const forwardData = await GoogleMapsService.forwardGeocode(address.trim());
    return {
      ...forwardData.parsed,
      latitude: forwardData.latitude,
      longitude: forwardData.longitude,
    };
  }

  return null;
};

export const getAllListings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parseNumberList = (value: unknown): number[] | undefined => {
      if (typeof value !== "string" || value.trim() === "") return undefined;
      const list = value
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isFinite(item));
      return list.length > 0 ? list : undefined;
    };

    const parseBooleanList = (value: unknown): boolean[] | undefined => {
      if (typeof value !== "string" || value.trim() === "") return undefined;
      const list = value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item === "true" || item === "false")
        .map((item) => item === "true");
      return list.length > 0 ? list : undefined;
    };

    const parseStringList = (value: unknown): string[] | undefined => {
      if (typeof value !== "string" || value.trim() === "") return undefined;
      const list = value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      return list.length > 0 ? list : undefined;
    };

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const result = await ListingsService.getAllListings(page, limit, {
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      city: typeof req.query.city === "string" ? req.query.city : undefined,
      minRent: Number.isFinite(Number(req.query.minRent)) ? Number(req.query.minRent) : undefined,
      maxRent: Number.isFinite(Number(req.query.maxRent)) ? Number(req.query.maxRent) : undefined,
      maxOccupants: parseNumberList(req.query.maxOccupants),
      floorLevelId: parseNumberList(req.query.floorLevelId),
      furnishingTypeId: parseNumberList(req.query.furnishingTypeId),
      foodPreferenceId: parseNumberList(req.query.foodPreferenceId),
      coolingTypeId: parseNumberList(req.query.coolingTypeId),
      propertyTypeId: parseNumberList(req.query.propertyTypeId),
      gender: parseStringList(req.query.gender),
      allowSmoking: parseBooleanList(req.query.allowSmoking),
      sortBy:
        req.query.sortBy === "rent_asc" ||
        req.query.sortBy === "rent_desc" ||
        req.query.sortBy === "newest"
          ? req.query.sortBy
          : "newest",
    });

    const { items, total } = result;
    console.log("[GET /api/listings] total:", total, "| items returned:", items.length);
    console.log("[GET /api/listings] items:", JSON.stringify(items, null, 2));

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items,
    });
  } catch (error) {
    next(error);
  }
};

export const getLocationOptions = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const items = await ListingsService.getLocationOptions();
    res.status(200).json({ items });
  } catch (error) {
    next(error);
  }
};

export const getListingById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let { listingId } = req.params;
    if (Array.isArray(listingId)) listingId = listingId[0];
    if (!listingId) {
      res.status(400).json({ error: "listingId is required" });
      return;
    }

    const item = await ListingsService.getListingById(listingId);
    if (!item) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }

    res.status(200).json(item);
  } catch (error) {
    next(error);
  }
};

export const createSingleListing = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Assuming authentication middleware puts landlord info on req.user.
    // For now we mock the landlordId if it's missing, since OTP is bypassed.
    const landlordId = (req as any).user?.id || req.body.landlordId;
    if (!landlordId) {
      res.status(401).json({ error: "Unauthorized / Missing LandlordId" });
      return;
    }

    const { location: coords, address, room, photos } = req.body as {
      location?: { latitude?: number; longitude?: number };
      address?: string;
      room?: {
        floorLevelId?: number;
        maxOccupants?: number;
        foodPreferenceId?: number;
        coolingTypeId?: number;
        allowSmoking?: boolean;
        monthlyRent?: number;
        furnishingTypeId?: number;
        availableFrom?: string;
        description?: string;
        securityDeposit?: number | null;
        propertyTypeId?: number;
        foodLevelId?: number;
        bedType?: "Single" | "Double" | "Mixed";
        singleBedCount?: number;
        doubleBedCount?: number;
      };
      photos?: {
        photoType?: "Room" | "Exterior";
        photoUrl?: string;
        blobId?: string;
        displayOrder?: number;
      }[];
    };

    if (!coords && !address) {
      res.status(400).json({ error: "Either Location coordinates or an Address string are required" });
      return;
    }
    if (!room) {
      res.status(400).json({ error: "Room details are required" });
      return;
    }
    if (
      room.floorLevelId === undefined ||
      room.maxOccupants === undefined ||
      room.foodPreferenceId === undefined ||
      room.allowSmoking === undefined ||
      room.monthlyRent === undefined ||
      room.furnishingTypeId === undefined ||
      !room.availableFrom
    ) {
      res.status(400).json({
        error:
          "Room must include floorLevelId, maxOccupants, foodPreferenceId, allowSmoking, monthlyRent, furnishingTypeId, and availableFrom",
      });
      return;
    }

    if (photos && !Array.isArray(photos)) {
      res.status(400).json({ error: "photos must be an array" });
      return;
    }

    let typedPhotos:
      | {
          photoType: "Room" | "Exterior";
          photoUrl: string;
          blobId?: string;
          displayOrder?: number;
        }[]
      | undefined;

    if (Array.isArray(photos) && photos.length > 0) {
      const roomPhotos = photos.filter((p) => p?.photoType === "Room");
      const exteriorPhotos = photos.filter((p) => p?.photoType === "Exterior");

      if (roomPhotos.length > 2) {
        res.status(400).json({ error: "A listing can have at most 2 Room photos" });
        return;
      }
      if (exteriorPhotos.length > 1) {
        res.status(400).json({ error: "A listing can have at most 1 Exterior photo" });
        return;
      }
      if (photos.some((p) => !p?.photoType || !p?.photoUrl)) {
        res.status(400).json({ error: "Each photo must include photoType and photoUrl" });
        return;
      }

      typedPhotos = photos.map((p) => ({
        photoType: p.photoType as "Room" | "Exterior",
        photoUrl: p.photoUrl as string,
        blobId: p.blobId,
        displayOrder: p.displayOrder,
      }));
    }

    const fullLocation = await resolveFullLocation(coords, address);
    if (!fullLocation) {
      res.status(400).json({ error: "Invalid location format" });
      return;
    }

    // 2. Create Listing
    const payload = {
      landlordId,
      roomDetails: {
        floorLevelId: room.floorLevelId,
        maxOccupants: room.maxOccupants,
        foodPreferenceId: room.foodPreferenceId,
        coolingTypeId: room.coolingTypeId,
        allowSmoking: room.allowSmoking,
        monthlyRent: room.monthlyRent,
        furnishingTypeId: room.furnishingTypeId,
        availableFrom: room.availableFrom,
        description: room.description,
        securityDeposit: room.securityDeposit,
        propertyTypeId: room.propertyTypeId,
        foodLevelId: room.foodLevelId,
        bedType: room.bedType,
        singleBedCount: room.singleBedCount,
        doubleBedCount: room.doubleBedCount,
      },
      photos: typedPhotos,
      location: fullLocation,
    };

    if (!fullLocation) {
      res.status(400).json({ error: "Location could not be determined" });
      return;
    }
    const listingId = await ListingsService.createSingleListing({ ...payload, location: fullLocation });

    res.status(201).json({
      message: "Listing created successfully",
      listingId,
    });
  } catch (error) {
    next(error);
  }
};

export const createBulkListings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const landlordId = (req as any).user?.id || req.body.landlordId;
    if (!landlordId) {
      res.status(401).json({ error: "Unauthorized / Missing LandlordId" });
      return;
    }

    const { location: coords, address, rooms } = req.body;

    if (!coords && !address) {
      res.status(400).json({ error: "Either Location coordinates or an Address string are required" });
      return;
    }
    if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
      res.status(400).json({ error: "An array of room details is required" });
      return;
    }

    const fullLocation = await resolveFullLocation(coords, address);
    if (!fullLocation) {
      res.status(400).json({ error: "Invalid location format" });
      return;
    }

    // 2. Bulk Insert array
    if (!fullLocation) {
      res.status(400).json({ error: "Location could not be determined" });
      return;
    }
    const listingIds = await ListingsService.createBulkListings(
      landlordId,
      rooms,
      fullLocation
    );

    res.status(201).json({
      message: `${listingIds.length} listings created successfully`,
      listingIds,
    });
  } catch (error) {
    next(error);
  }
};

export const createListingsWithMedia = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const landlordId = (req as any).user?.id || req.body.landlordId;
    if (!landlordId) {
      res.status(401).json({ error: "Unauthorized / Missing LandlordId" });
      return;
    }

    const rawData = req.body?.data;
    if (typeof rawData !== "string" || !rawData.trim()) {
      res.status(400).json({ error: "data payload is required" });
      return;
    }

    let parsedBody: {
      location?: { latitude?: number; longitude?: number };
      address?: string;
      rooms?: Array<{
        floorLevelId?: number;
        maxOccupants?: number;
        foodPreferenceId?: number;
        coolingTypeId?: number;
        allowSmoking?: boolean;
        monthlyRent?: number;
        furnishingTypeId?: number;
        availableFrom?: string;
        description?: string;
        securityDeposit?: number | null;
        propertyTypeId?: number;
        foodLevelId?: number;
        bedType?: "Single" | "Double" | "Mixed";
        singleBedCount?: number;
        doubleBedCount?: number;
        rentTiers?: { occupants: number; rent: number }[];
      }>;
      exteriorPhotoUrl?: string;
      roomPhotoUrls?: string[][];
    };

    try {
      parsedBody = JSON.parse(rawData);
    } catch {
      res.status(400).json({ error: "Invalid JSON in data payload" });
      return;
    }

    const { location: coords, address, rooms, exteriorPhotoUrl, roomPhotoUrls } = parsedBody;

    if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
      res.status(400).json({ error: "At least one room is required" });
      return;
    }

    const fullLocation = await resolveFullLocation(coords, address);
    if (!fullLocation) {
      res.status(400).json({ error: "Location could not be determined" });
      return;
    }

    const files = Array.isArray(req.files)
      ? (req.files as Express.Multer.File[])
      : [];

    const uploadedByField = new Map<string, { url: string; blobId: string }>();
    for (const file of files) {
      if (!file || !file.fieldname) continue;
      const uploaded = await BlobService.uploadImage(file);
      uploadedByField.set(file.fieldname, {
        url: uploaded.accessUrl,
        blobId: uploaded.blobId,
      });
    }

    const listingIds: string[] = [];

    for (let roomIndex = 0; roomIndex < rooms.length; roomIndex += 1) {
      const room = rooms[roomIndex];
      if (!room) continue;

      const photos: Array<{
        photoType: "Room" | "Exterior";
        photoUrl: string;
        blobId?: string;
        displayOrder?: number;
      }> = [];

      const uploadedExterior = uploadedByField.get("exteriorFile");
      const normalizedExteriorUrl = (exteriorPhotoUrl || "").trim();

      if (uploadedExterior) {
        photos.push({
          photoType: "Exterior",
          photoUrl: uploadedExterior.url,
          blobId: uploadedExterior.blobId,
        });
      } else if (normalizedExteriorUrl) {
        photos.push({
          photoType: "Exterior",
          photoUrl: normalizedExteriorUrl,
        });
      }

      const roomUrls = roomPhotoUrls?.[roomIndex] || [];
      for (let imageIndex = 0; imageIndex < roomUrls.length; imageIndex += 1) {
        const uploadedRoom = uploadedByField.get(`roomFile-${roomIndex}-${imageIndex}`);
        const manualRoomUrl = (roomUrls[imageIndex] || "").trim();

        if (uploadedRoom) {
          photos.push({
            photoType: "Room",
            photoUrl: uploadedRoom.url,
            blobId: uploadedRoom.blobId,
            displayOrder: photos.length + 1,
          });
          continue;
        }

        if (!manualRoomUrl) continue;
        photos.push({
          photoType: "Room",
          photoUrl: manualRoomUrl,
          displayOrder: photos.length + 1,
        });
      }

      const listingId = await ListingsService.createSingleListing({
        landlordId,
        roomDetails: {
          floorLevelId: room.floorLevelId as number,
          maxOccupants: room.maxOccupants as number,
          foodPreferenceId: room.foodPreferenceId as number,
          coolingTypeId: room.coolingTypeId,
          allowSmoking: room.allowSmoking as boolean,
          monthlyRent: room.monthlyRent as number,
          furnishingTypeId: room.furnishingTypeId as number,
          availableFrom: room.availableFrom as string,
          description: room.description,
          securityDeposit: room.securityDeposit,
          propertyTypeId: room.propertyTypeId,
          foodLevelId: room.foodLevelId,
          bedType: room.bedType,
          singleBedCount: room.singleBedCount,
          doubleBedCount: room.doubleBedCount,
          rentTiers: Array.isArray(room.rentTiers) ? room.rentTiers : undefined,
        },
        photos,
        location: fullLocation,
      });

      listingIds.push(listingId);
    }

    res.status(201).json({
      message:
        listingIds.length === 1
          ? "Listing created successfully"
          : `${listingIds.length} listings created successfully`,
      listingIds,
    });
  } catch (error) {
    next(error);
  }
};

export const updateListing = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const landlordId = (req as any).user?.id || req.body.landlordId;
    if (!landlordId) {
      res.status(401).json({ error: "Unauthorized / Missing LandlordId" });
      return;
    }

    let { listingId } = req.params;
    if (Array.isArray(listingId)) listingId = listingId[0];
    if (!listingId) {
      res.status(400).json({ error: "listingId is required" });
      return;
    }

    const rawData = req.body?.data;
    let payload: {
      location?: { latitude?: number; longitude?: number };
      address?: string;
      room?: {
        floorLevelId?: number;
        maxOccupants?: number;
        foodPreferenceId?: number;
        coolingTypeId?: number;
        allowSmoking?: boolean;
        monthlyRent?: number;
        furnishingTypeId?: number;
        availableFrom?: string;
        description?: string;
        securityDeposit?: number | null;
        propertyTypeId?: number;
        foodLevelId?: number;
        bedType?: "Single" | "Double" | "Mixed";
        singleBedCount?: number;
        doubleBedCount?: number;
      };
      photos?: {
        photoType?: "Room" | "Exterior";
        photoUrl?: string;
        blobId?: string;
        displayOrder?: number;
      }[];
      exteriorPhotoUrl?: string;
      roomPhotoUrls?: string[];
    };

    if (typeof rawData === "string" && rawData.trim()) {
      try {
        payload = JSON.parse(rawData);
      } catch {
        res.status(400).json({ error: "Invalid JSON in data payload" });
        return;
      }
    } else {
      payload = req.body;
    }

    const { location: coords, address, room, photos, exteriorPhotoUrl, roomPhotoUrls } = payload;

    if (!coords && !address) {
      res.status(400).json({ error: "Either Location coordinates or an Address string are required" });
      return;
    }
    if (!room) {
      res.status(400).json({ error: "Room details are required" });
      return;
    }
    if (
      room.floorLevelId === undefined ||
      room.maxOccupants === undefined ||
      room.foodPreferenceId === undefined ||
      room.allowSmoking === undefined ||
      room.monthlyRent === undefined ||
      room.furnishingTypeId === undefined ||
      !room.availableFrom
    ) {
      res.status(400).json({
        error:
          "Room must include floorLevelId, maxOccupants, foodPreferenceId, allowSmoking, monthlyRent, furnishingTypeId, and availableFrom",
      });
      return;
    }

    const fullLocation = await resolveFullLocation(coords, address);
    if (!fullLocation) {
      res.status(400).json({ error: "Location could not be determined" });
      return;
    }

    let typedPhotos:
      | {
          photoType: "Room" | "Exterior";
          photoUrl: string;
          blobId?: string;
          displayOrder?: number;
        }[]
      | undefined;

    if (Array.isArray(photos)) {
      typedPhotos = photos
        .filter((photo) => photo?.photoType && photo?.photoUrl)
        .map((photo, index) => ({
          photoType: photo.photoType as "Room" | "Exterior",
          photoUrl: String(photo.photoUrl),
          ...(photo.blobId ? { blobId: photo.blobId } : {}),
          displayOrder: photo.displayOrder ?? index + 1,
        }));
    } else {
      const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];
      const uploadedByField = new Map<string, { url: string; blobId: string }>();
      for (const file of files) {
        if (!file?.fieldname) continue;
        const uploaded = await BlobService.uploadImage(file);
        uploadedByField.set(file.fieldname, { url: uploaded.accessUrl, blobId: uploaded.blobId });
      }

      const builtPhotos: {
        photoType: "Room" | "Exterior";
        photoUrl: string;
        blobId?: string;
        displayOrder?: number;
      }[] = [];

      const uploadedExterior = uploadedByField.get("exteriorFile");
      const normalizedExteriorUrl = (exteriorPhotoUrl || "").trim();
      if (uploadedExterior) {
        builtPhotos.push({
          photoType: "Exterior",
          photoUrl: uploadedExterior.url,
          blobId: uploadedExterior.blobId,
        });
      } else if (normalizedExteriorUrl) {
        builtPhotos.push({
          photoType: "Exterior",
          photoUrl: normalizedExteriorUrl,
        });
      }

      const roomUrls = Array.isArray(roomPhotoUrls) ? roomPhotoUrls : [];
      const roomSlots = Math.max(
        roomUrls.length,
        ...[...uploadedByField.keys()]
          .map((key) => {
            const match = /^roomFile-(\d+)$/.exec(key);
            return match ? Number(match[1]) + 1 : 0;
          })
          .filter((value) => Number.isFinite(value))
      );

      for (let idx = 0; idx < roomSlots; idx += 1) {
        const uploadedRoom = uploadedByField.get(`roomFile-${idx}`);
        const manualRoomUrl = (roomUrls[idx] || "").trim();
        if (uploadedRoom) {
          builtPhotos.push({
            photoType: "Room",
            photoUrl: uploadedRoom.url,
            blobId: uploadedRoom.blobId,
            displayOrder: builtPhotos.length + 1,
          });
          continue;
        }
        if (!manualRoomUrl) continue;
        builtPhotos.push({
          photoType: "Room",
          photoUrl: manualRoomUrl,
          displayOrder: builtPhotos.length + 1,
        });
      }

      typedPhotos = builtPhotos;
    }

    const updated = await ListingsService.updateListingById({
      landlordId,
      listingId,
      roomDetails: {
        floorLevelId: room.floorLevelId,
        maxOccupants: room.maxOccupants,
        foodPreferenceId: room.foodPreferenceId,
        coolingTypeId: room.coolingTypeId,
        allowSmoking: room.allowSmoking,
        monthlyRent: room.monthlyRent,
        furnishingTypeId: room.furnishingTypeId,
        availableFrom: room.availableFrom,
        description: room.description,
        securityDeposit: room.securityDeposit,
        propertyTypeId: room.propertyTypeId,
        foodLevelId: room.foodLevelId,
        bedType: room.bedType,
        singleBedCount: room.singleBedCount,
        doubleBedCount: room.doubleBedCount,
      },
      location: fullLocation,
      ...(typedPhotos ? { photos: typedPhotos } : {}),
    });

    if (!updated) {
      res.status(404).json({ error: "Listing not found or you are not allowed to update it" });
      return;
    }

    res.status(200).json({ message: "Listing updated successfully" });
  } catch (error) {
    next(error);
  }
};

export const getMyListings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const landlordId = (req as any).user?.id || req.body.landlordId;
    if (!landlordId) {
      res.status(401).json({ error: "Unauthorized / Missing LandlordId" });
      return;
    }

    // Use getAllListings with a landlord filter since getMyListings does not exist
    const { items } = await ListingsService.getAllListings(1, 100, { landlordId });
    res.status(200).json({ listings: items });
  } catch (error) {
    next(error);
  }
};

export const deleteListing = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const landlordId = (req as any).user?.id;
    if (!landlordId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    let { listingId } = req.params;
    if (Array.isArray(listingId)) listingId = listingId[0];
    if (!listingId) {
      res.status(400).json({ error: "listingId is required" });
      return;
    }

    const deleted = await ListingsService.deleteListingById(listingId, landlordId);
    if (!deleted) {
      res.status(404).json({ error: "Listing not found or not owned by you" });
      return;
    }

    res.status(200).json({ message: "Listing deleted successfully" });
  } catch (error) {
    next(error);
  }
};

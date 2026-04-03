import type { Request, Response, NextFunction } from "express";
import { GoogleMapsService } from "../services/googleMaps.service";
import { ListingsService } from "../services/listings.service";

export const getAllListings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const { items, total } = await ListingsService.getAllListings(page, limit);

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
      | { photoType: "Room" | "Exterior"; photoUrl: string; displayOrder?: number }[]
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
        displayOrder: p.displayOrder,
      }));
    }

    let fullLocation;
    if (coords && coords.latitude && coords.longitude) {
      // 1A. Reverse Geocode from coords
      const parsedAddress = await GoogleMapsService.reverseGeocode(coords.latitude, coords.longitude);
      fullLocation = {
        ...parsedAddress,
        latitude: coords.latitude,
        longitude: coords.longitude,
      };
    } else if (address) {
      // 1B. Forward Geocode from string
      const forwardData = await GoogleMapsService.forwardGeocode(address);
      fullLocation = {
        ...forwardData.parsed,
        latitude: forwardData.latitude,
        longitude: forwardData.longitude,
      };
    } else {
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

    const listingId = await ListingsService.createSingleListing(payload);

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

    let fullLocation;
    // 1. Geocode (Only once for all rooms)
    if (coords && coords.latitude && coords.longitude) {
      const parsedAddress = await GoogleMapsService.reverseGeocode(coords.latitude, coords.longitude);
      fullLocation = {
        ...parsedAddress,
        latitude: coords.latitude,
        longitude: coords.longitude,
      };
    } else if (address) {
      const forwardData = await GoogleMapsService.forwardGeocode(address);
      fullLocation = {
        ...forwardData.parsed,
        latitude: forwardData.latitude,
        longitude: forwardData.longitude,
      };
    } else {
      res.status(400).json({ error: "Invalid location format" });
      return;
    }

    // 2. Bulk Insert array
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

    const listings = await ListingsService.getMyListings(landlordId);
    res.status(200).json({ listings });
  } catch (error) {
    next(error);
  }
};

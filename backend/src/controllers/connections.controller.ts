import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { ContactRequest } from "../models/ContactRequest.js";
import Listing from "../models/Listing.js";
import User from "../models/User.js";

// POST /api/connections
// Tenant clicks "Connect Owner" on a listing
export const connectOwner = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = (req as any).user?.id;
    if (!tenantId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { listingId } = req.body as { listingId?: string };
    if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
      res.status(400).json({ error: "Valid listingId is required" });
      return;
    }

    const listing = await Listing.findById(listingId).select("landlordId isActive").lean();
    if (!listing || !listing.isActive) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }

    const landlordId = String(listing.landlordId);
    if (String(tenantId) === landlordId) {
      res.status(400).json({ error: "You cannot connect with your own listing" });
      return;
    }

    // Check if a request already exists (any status)
    const existing = await ContactRequest.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      listingId: new mongoose.Types.ObjectId(listingId),
    }).lean();

    if (existing) {
      res.status(200).json({
        message: "Already requested",
        connectionId: String(existing._id),
        status: existing.status,
        isConnected: existing.isConnected,
      });
      return;
    }

    const connection = await ContactRequest.create({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      listingId: new mongoose.Types.ObjectId(listingId),
      landlordId: new mongoose.Types.ObjectId(landlordId),
      status: "Pending",
      isConnected: false,
    });

    res.status(201).json({
      message: "Connection request sent",
      connectionId: String(connection._id),
      status: "Pending",
      isConnected: false,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/connections/my-status/:listingId
// Tenant checks their connection status for a specific listing
export const getMyConnectionStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tenantId = (req as any).user?.id;
    if (!tenantId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    let { listingId } = req.params;
    if (Array.isArray(listingId)) listingId = listingId[0];
    if (!listingId || !mongoose.Types.ObjectId.isValid(listingId)) {
      res.status(400).json({ error: "Invalid listingId" });
      return;
    }

    const connection = await ContactRequest.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      listingId: new mongoose.Types.ObjectId(listingId),
    }).lean();

    if (!connection) {
      res.status(200).json({ connection: null });
      return;
    }

    res.status(200).json({
      connection: {
        connectionId: String(connection._id),
        status: connection.status,
        isConnected: connection.isConnected,
        createdAt: connection.createdAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/connections/landlord
// Landlord sees all tenants who clicked "Connect Owner" on their listings
export const getLandlordConnections = async (
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

    const connections = await ContactRequest.find({
      landlordId: new mongoose.Types.ObjectId(landlordId),
    })
      .sort({ createdAt: -1 })
      .lean();

    // Gather unique tenantIds and listingIds for batch population
    const tenantIds = [...new Set(connections.map((c) => String(c.tenantId)))];
    const listingIds = [...new Set(connections.map((c) => String(c.listingId)))];

    const [tenants, listings] = await Promise.all([
      User.find({ _id: { $in: tenantIds } })
        .select("fullName email phone photoUrl")
        .lean(),
      Listing.find({ _id: { $in: listingIds } })
        .select("title colony city monthlyRent")
        .lean(),
    ]);

    const tenantMap = new Map(tenants.map((t) => [String(t._id), t]));
    const listingMap = new Map(listings.map((l) => [String(l._id), l]));

    const items = connections.map((c) => {
      const tenant = tenantMap.get(String(c.tenantId));
      const listing = listingMap.get(String(c.listingId));
      return {
        connectionId: String(c._id),
        tenantId: String(c.tenantId),
        tenantName: tenant?.fullName ?? "Unknown",
        tenantEmail: tenant?.email ?? null,
        tenantPhone: tenant?.phone ?? null,
        tenantPhoto: tenant?.photoUrl ?? null,
        listingId: String(c.listingId),
        listingTitle: listing ? `${listing.title} · ${listing.colony}, ${listing.city}` : "Unknown Listing",
        monthlyRent: listing?.monthlyRent ?? 0,
        status: c.status,
        isConnected: c.isConnected,
        requestedAt: c.createdAt.toISOString(),
        respondedAt: c.respondedAt ? c.respondedAt.toISOString() : null,
      };
    });

    res.status(200).json({ items });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/connections/:id/deal-done
// Landlord marks deal as done → isConnected = true, status = Accepted
export const dealDone = async (
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

    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid connection id" });
      return;
    }

    const connection = await ContactRequest.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        landlordId: new mongoose.Types.ObjectId(landlordId),
      },
      {
        $set: {
          status: "Accepted",
          isConnected: true,
          respondedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    res.status(200).json({ message: "Deal marked as done", isConnected: true });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/connections/:id/deal-close
// Landlord closes the deal → status = Rejected, isConnected stays false
export const dealClose = async (
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

    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid connection id" });
      return;
    }

    const connection = await ContactRequest.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        landlordId: new mongoose.Types.ObjectId(landlordId),
      },
      {
        $set: {
          status: "Rejected",
          isConnected: false,
          respondedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    res.status(200).json({ message: "Deal closed" });
  } catch (error) {
    next(error);
  }
};

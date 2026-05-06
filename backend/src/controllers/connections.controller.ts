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

    const { listingId, occupants } = req.body as { listingId?: string; occupants?: number };
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
      occupants: occupants && occupants > 0 ? occupants : undefined,
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

// GET /api/connections/mine
// Tenant sees every property they have contacted
export const getTenantConnections = async (
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

    const connections = await ContactRequest.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
    })
      .sort({ createdAt: -1 })
      .lean();

    const listingIds = [...new Set(connections.map((c) => String(c.listingId)))];
    const listings = await Listing.find({ _id: { $in: listingIds } })
      .select("title colony city monthlyRent maxOccupants photos isActive")
      .lean();

    const listingMap = new Map(listings.map((listing) => [String(listing._id), listing]));

    const items = connections.map((connection) => {
      const listing = listingMap.get(String(connection.listingId));
      const coverPhoto = listing?.photos?.[0]?.photoUrl ?? null;

      return {
        connectionId: String(connection._id),
        listingId: String(connection.listingId),
        title: listing?.title ?? "Listing unavailable",
        colony: listing?.colony ?? "Unknown area",
        city: listing?.city ?? "Unknown city",
        monthlyRent: listing?.monthlyRent ?? 0,
        maxOccupants: listing?.maxOccupants ?? 0,
        coverPhotoUrl: coverPhoto,
        status: connection.status,
        isConnected: connection.isConnected,
        requestedAt: connection.createdAt.toISOString(),
        respondedAt: connection.respondedAt ? connection.respondedAt.toISOString() : null,
        listingActive: listing?.isActive ?? false,
      };
    });

    res.status(200).json({ items });
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
        .select("title colony city monthlyRent maxOccupants")
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
        maxOccupants: listing?.maxOccupants ?? 0,
        requestedOccupants: c.occupants ?? null,
        rentPayments: Array.isArray(c.rentPayments)
          ? [...c.rentPayments].sort((a, b) => b.month.localeCompare(a.month))
          : [],
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

// PATCH /api/connections/:id/rent-payment
// Landlord marks whether a tenant paid rent OnTime or Late for current month
// A saved month's status can be corrected only once
export const markMonthlyRentPayment = async (
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

    const { month, paymentStatus } = req.body as {
      month?: string;
      paymentStatus?: "OnTime" | "Late";
      paymentSlipUrl?: string;
      paymentSlipBlobId?: string;
    };

    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      res.status(400).json({ error: "month is required in YYYY-MM format" });
      return;
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (month !== currentMonth) {
      res.status(400).json({
        error: "Only current month is allowed",
        currentMonth,
      });
      return;
    }

    if (!paymentStatus || !["OnTime", "Late"].includes(paymentStatus)) {
      res.status(400).json({ error: "paymentStatus must be OnTime or Late" });
      return;
    }

    const connection = await ContactRequest.findOne({
      _id: new mongoose.Types.ObjectId(id),
      landlordId: new mongoose.Types.ObjectId(landlordId),
    });

    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    if (connection.status !== "Accepted") {
      res.status(400).json({ error: "Rent status can only be updated for accepted tenants" });
      return;
    }

    const { paymentSlipUrl, paymentSlipBlobId } = req.body as {
      paymentSlipUrl?: string;
      paymentSlipBlobId?: string;
    };

    const existingIndex = connection.rentPayments.findIndex((entry) => entry.month === month);
    if (existingIndex >= 0) {
      const existingEntry = connection.rentPayments.at(existingIndex);
      if (!existingEntry) {
        res.status(500).json({ error: "Rent payment entry could not be loaded" });
        return;
      }

      const statusChanged = existingEntry.paymentStatus !== paymentStatus;
      const slipUrlChanged = (paymentSlipUrl ?? "") !== (existingEntry.paymentSlipUrl ?? "");
      const slipBlobChanged = (paymentSlipBlobId ?? "") !== (existingEntry.paymentSlipBlobId ?? "");
      const hasChange = statusChanged || slipUrlChanged || slipBlobChanged;

      if (!hasChange) {
        res.status(200).json({
          message: `Rent payment for ${month} is already up to date`,
          connectionId: String(connection._id),
          rentPayments: [...connection.rentPayments].sort((a, b) => b.month.localeCompare(a.month)),
        });
        return;
      }

      const usedUpdates = existingEntry.updateCount ?? 0;
      if (usedUpdates >= 1) {
        res.status(400).json({
          error: "Update limit reached",
          message: "You can update rent status only one time after first save for the current month",
        });
        return;
      }

      existingEntry.paymentStatus = paymentStatus;
      existingEntry.markedAt = new Date();
      existingEntry.updateCount = usedUpdates + 1;
      if (paymentSlipUrl) {
        existingEntry.paymentSlipUrl = paymentSlipUrl;
        existingEntry.paymentSlipBlobId = paymentSlipBlobId;
      }
    } else {
      connection.rentPayments.push({
        month,
        paymentStatus,
        markedAt: new Date(),
        updateCount: 0,
        paymentSlipUrl,
        paymentSlipBlobId,
      });
    }

    await connection.save();

    const rentPayments = [...connection.rentPayments].sort((a, b) => b.month.localeCompare(a.month));

    res.status(200).json({
      message: `Rent payment for ${month} marked as ${paymentStatus === "OnTime" ? "On Time" : "Late"}`,
      connectionId: String(connection._id),
      rentPayments,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/connections/:id/deal-done
// Landlord marks deal as done → isConnected = true, status = Accepted
// Validates that tenant's occupant requirement matches room capacity
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

    // First, get the connection details
    const connection = await ContactRequest.findOne({
      _id: new mongoose.Types.ObjectId(id),
      landlordId: new mongoose.Types.ObjectId(landlordId),
    }).lean();

    if (!connection) {
      res.status(404).json({ error: "Connection not found" });
      return;
    }

    // If tenant specified occupants, validate against room capacity
    if (connection.occupants) {
      const listing = await Listing.findById(connection.listingId).select("maxOccupants").lean();
      if (!listing) {
        res.status(404).json({ error: "Listing not found" });
        return;
      }

      if (connection.occupants > listing.maxOccupants) {
        res.status(400).json({
          error: "Occupant validation failed",
          message: `Tenant requested ${connection.occupants} occupant(s) but room capacity is only ${listing.maxOccupants}`,
          requestedOccupants: connection.occupants,
          maxOccupants: listing.maxOccupants,
        });
        return;
      }
    }

    // Update the connection
    const updatedConnection = await ContactRequest.findOneAndUpdate(
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

    if (!updatedConnection) {
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

// DELETE /api/connections/:id
// Tenant cancels their own pending request
export const cancelRequest = async (
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

    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid connection id" });
      return;
    }

    const connection = await ContactRequest.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      status: "Pending",
    });

    if (!connection) {
      res.status(404).json({ error: "Pending request not found" });
      return;
    }

    res.status(200).json({ message: "Request cancelled" });
  } catch (error) {
    next(error);
  }
};

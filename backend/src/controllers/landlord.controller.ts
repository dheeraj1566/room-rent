// import { Request, Response } from "express";
import ContactRequest from "../models/ContactRequest";
import mongoose from "mongoose";

// GET /api/landlord/rooms-status?landlordId=xxxx
export const getLandlordRoomsStatus = async (req: Request, res: Response) => {
  try {
    const landlordId = req.query.landlordId as string;
    if (!landlordId) {
      return res.status(400).json({ error: "landlordId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(landlordId)) {
      return res.status(400).json({ error: "Invalid landlordId format" });
    }

    const data = await ContactRequest.aggregate([
      { $match: { landlordId: new mongoose.Types.ObjectId(landlordId), status: "Accepted" } },
      {
        $lookup: {
          from: "users",
          localField: "tenantId",
          foreignField: "_id",
          as: "tenant"
        }
      },
      {
        $lookup: {
          from: "listings",
          localField: "listingId",
          foreignField: "_id",
          as: "listing"
        }
      },
      {
        $project: {
          _id: 0,
          "tenantName": { $arrayElemAt: ["$tenant.fullName", 0] },
          "roomTitle": { $arrayElemAt: ["$listing.title", 0] },
          rentPayments: 1
        }
      }
    ]);

    res.json({ success: true, data });
  } catch (err) {
    // Log the error for debugging
    // eslint-disable-next-line no-console
    console.error("Error in getLandlordRoomsStatus:", err);
    res.status(500).json({ error: "Server error", details: err instanceof Error ? err.message : err });
  }
};

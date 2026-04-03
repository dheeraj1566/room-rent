import { Router } from "express";
import {
  getAllListings,
  createSingleListing,
  createBulkListings,
} from "../controllers/listings.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// Enforce auth middleware for all listing routes
router.use(requireAuth);

// Get all active listings
router.get("/", getAllListings);

// Single room submission
router.post("/", createSingleListing);

// Bulk rooms submission (multiple rooms down this location)
router.post("/bulk", createBulkListings);

export default router;

import { Router } from "express";
<<<<<<< Updated upstream
import {
  getAllListings,
  createSingleListing,
  createBulkListings,
} from "../controllers/listings.controller";
=======
import { createSingleListing, createBulkListings, getMyListings } from "../controllers/listings.controller";
>>>>>>> Stashed changes
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// Enforce auth middleware for all listing routes
router.use(requireAuth);

<<<<<<< Updated upstream
// Get all active listings
router.get("/", getAllListings);
=======
// Get my listings
router.get("/my", getMyListings);
>>>>>>> Stashed changes

// Single room submission
router.post("/", createSingleListing);

// Bulk rooms submission (multiple rooms down this location)
router.post("/bulk", createBulkListings);

export default router;

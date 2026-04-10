import { Router } from "express";
import multer from "multer";
import {
  getAllListings,
  getLocationOptions,
  getMyListings,
  getListingById,
  createListingsWithMedia,
  updateListing,
} from "../controllers/listings.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

// Enforce auth middleware for all listing routes
router.use(requireAuth);

// Get all active listings
router.get("/", getAllListings);
router.get("/location-options", getLocationOptions);
router.get("/mine", getMyListings);
router.get("/:listingId", getListingById);

// Single publish request: details + media files together
router.post("/submit", upload.any(), createListingsWithMedia);
router.put("/:listingId", upload.any(), updateListing);

export default router;

import { Router } from "express";

import listingsRoutes from "./listings.routes";
import authRoutes from "./auth.routes";
import uploadRoutes from "./upload.routes";
import favoritesRoutes from "./favorites.routes";
import testimonialsRoutes from "./testimonials.routes";
import connectionsRoutes from "./connections.routes";
import adminRoutes from "./admin.routes";
import landlordRoutes from "./landlord.routes";

const router = Router();

// Health check
router.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running 🚀",
    timestamp: new Date().toISOString(),
  });
});

// Register route modules here
router.use("/auth", authRoutes);
router.use("/listings", listingsRoutes);
router.use("/uploads", uploadRoutes);
router.use("/favorites", favoritesRoutes);
router.use("/testimonials", testimonialsRoutes);
router.use("/connections", connectionsRoutes);

router.use("/landlord", landlordRoutes);
router.use("/admin", adminRoutes);

export default router;

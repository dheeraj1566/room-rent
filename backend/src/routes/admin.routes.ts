import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/admin.middleware.js";
import {
  getAllUsers,
  getAllProperties,
  getEmailLogSummary,
  getEmailLogs,
} from "../controllers/admin.controller.js";

const router = Router();

// All admin routes require authentication and admin role
router.use(requireAuth, requireAdmin);

router.get("/users", getAllUsers);
router.get("/properties", getAllProperties);
router.get("/email-logs/summary", getEmailLogSummary);
router.get("/email-logs", getEmailLogs);

export default router;

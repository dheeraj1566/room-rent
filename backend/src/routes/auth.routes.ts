import { Router } from "express";
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  googleLogin,
  logout,
  me,
} from "../controllers/auth.controller.js";
import {
  createProfile,
  getProfile,
  updateProfile,
} from "../controllers/profile.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/google", googleLogin);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.get("/profile", requireAuth, getProfile);
router.post("/profile", requireAuth, createProfile);
router.put("/profile", requireAuth, updateProfile);

export default router;

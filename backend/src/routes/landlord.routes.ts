import { Router } from "express";
import { getLandlordRoomsStatus } from "../controllers/landlord.controller";

const router = Router();

// GET /api/landlord/rooms-status?landlordId=xxxx
router.get("/rooms-status", getLandlordRoomsStatus);

export default router;

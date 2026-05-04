import { Router } from "express";
import {
  connectOwner,
  getMyConnectionStatus,
  getTenantConnections,
  getLandlordConnections,
  dealDone,
  dealClose,
  markMonthlyRentPayment,
  cancelRequest,
} from "../controllers/connections.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

// All routes require auth
router.use(requireAuth);

router.post("/", connectOwner);                              // Tenant: connect to a listing's owner
router.get("/mine", getTenantConnections);                  // Tenant: see all contacted listings
router.get("/my-status/:listingId", getMyConnectionStatus); // Tenant: check their status for a listing
router.get("/landlord", getLandlordConnections);             // Landlord: see all connection requests
router.patch("/:id/deal-done", dealDone);                   // Landlord: mark deal done → isConnected = true
router.patch("/:id/deal-close", dealClose);                 // Landlord: close deal → status = Rejected
router.patch("/:id/rent-payment", markMonthlyRentPayment);  // Landlord: mark monthly rent payment as OnTime/Late
router.delete("/:id", cancelRequest);                       // Tenant: cancel pending request

export default router;

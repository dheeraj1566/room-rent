import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middlewares/auth.middleware";
import { BlobService } from "../services/blob.service.js";

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

router.post("/image", requireAuth, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "image file is required" });
      return;
    }

    const uploadResult = await BlobService.uploadImage(req.file);

    res.status(201).json({
      message: "Image uploaded successfully",
      url: uploadResult.accessUrl,
      blobUrl: uploadResult.blobUrl,
      blobId: uploadResult.blobId,
    });
  } catch (error: unknown) {
    const azureLike = error as {
      statusCode?: number;
      code?: string;
      message?: string;
      details?: { errorCode?: string; message?: string };
    };

    res.status(502).json({
      error: "Azure upload failed",
      azureStatusCode: azureLike.statusCode,
      azureCode: azureLike.code || azureLike.details?.errorCode,
      azureMessage: azureLike.details?.message || azureLike.message,
    });
    return;
  }
});

export default router;

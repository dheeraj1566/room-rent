import env from "../config/env.js";
// cloudinary provides its own types, no need for @types/cloudinary

// Lazy-load Cloudinary to avoid startup crash when package is missing
export class CloudinaryService {
  static async uploadBuffer(
    buffer: Buffer,
    options: { folder?: string; filename?: string; mimetype?: string } = {}
  ): Promise<{ public_id: string; secure_url: string }> {
    // Try dynamic import
    let cloudinary: any;
    try {
      const mod = await import("cloudinary");
      cloudinary = mod.v2 ?? mod;
    } catch (err) {
      throw new Error("Cloudinary package not installed");
    }

    // Configure using env vars
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    });

    const dataUri = `data:${options.mimetype || "image/jpeg"};base64,${buffer.toString("base64")}`;

    const uploadOptions: Record<string, any> = {
      resource_type: "image",
    };
    if (options.folder) uploadOptions.folder = options.folder;
    // Use filename (without extension) as public_id if provided
    if (options.filename) uploadOptions.public_id = String(options.filename).replace(/\.[^/.]+$/, "");

    return cloudinary.uploader.upload(dataUri, uploadOptions).then((res: any) => ({ public_id: res.public_id, secure_url: res.secure_url }));
  }
}

export default CloudinaryService;

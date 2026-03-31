import { z } from "zod";

export const healthSchema = z.object({
  status: z.literal("ok"),
  service: z.string()
});

export const userSchema = z.object({
  userName: z.string().trim().min(1, "userName is required"),
  phone: z.string().trim().regex(/^\+?\d{10,15}$/, "phone must be 10-15 digits and may start with +"),
  userEmail: z.string().trim().email("userEmail must be valid"),
  aadhaarNumber: z
    .string()
    .trim()
    .regex(/^\d{12}$/, "aadhaarNumber must be exactly 12 digits"),
  localAddress: z.string().trim().min(10, "localAddress is required"),
  hometownAddress: z.string().trim().min(10, "hometownAddress is required"),
  profilePhotoUrl: z.string().trim().url("profilePhotoUrl must be a valid URL")
});

export const userIdParamSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID")
});

export const propertySchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
  propertyName: z.string().trim().min(1, "propertyName is required"),
  address: z.string().trim().min(5, "address is required"),
  latitude: z.number().finite("latitude must be a valid number"),
  longitude: z.number().finite("longitude must be a valid number")
});

export const propertyIdParamSchema = z.object({
  propertyId: z.string().trim().min(1, "propertyId is required")
});

export const propertyQuerySchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID").optional()
});

export type Health = z.infer<typeof healthSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;
export type PropertyInput = z.infer<typeof propertySchema>;
export type PropertyIdParam = z.infer<typeof propertyIdParamSchema>;
export type PropertyQuery = z.infer<typeof propertyQuerySchema>;
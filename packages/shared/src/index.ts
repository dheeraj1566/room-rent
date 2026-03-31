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

export const propertyRoomSchema = z.object({
  typeId: z.number().int().positive("typeId is required"),
  roomLocationId: z.number().int().positive("roomLocationId is required"),
  coolingId: z.number().int().positive("coolingId is required"),
  interiorId: z.number().int().positive("interiorId is required"),
  foodPreferenceId: z.number().int().positive("foodPreferenceId is required"),
  smokingPreferenceId: z.number().int().positive("smokingPreferenceId is required"),
  price: z.number().finite("price must be valid").nonnegative("price must be non-negative"),
  balcony: z.boolean(),
  attachedWashroom: z.boolean()
});

export const propertySchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
  propertyName: z.string().trim().min(1, "propertyName is required"),
  address: z.string().trim().min(5, "address is required"),
  latitude: z.number().finite("latitude must be a valid number"),
  longitude: z.number().finite("longitude must be a valid number"),
  room: propertyRoomSchema,
  images: z.array(z.string().trim().url("image URL must be valid")).max(20).default([])
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
export type PropertyRoomInput = z.infer<typeof propertyRoomSchema>;
export type PropertyIdParam = z.infer<typeof propertyIdParamSchema>;
export type PropertyQuery = z.infer<typeof propertyQuerySchema>;

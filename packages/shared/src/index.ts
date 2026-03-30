import { z } from "zod";

export const healthSchema = z.object({
  status: z.literal("ok"),
  service: z.string()
});

export const userSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  phone: z.string().trim().regex(/^\d{10}$/, "phone must be exactly 10 digits"),
  email: z.string().trim().email("email must be valid"),
  aadhaarNumber: z
    .string()
    .trim()
    .regex(/^\d{12}$/, "aadhaarNumber must be exactly 12 digits"),
  localAddress: z.string().trim().min(10, "localAddress is required"),
  hometownAddress: z.string().trim().min(10, "hometownAddress is required"),
  profilePhotoUrl: z.string().trim().url("profilePhotoUrl must be a valid URL")
});

export type Health = z.infer<typeof healthSchema>;
export type UserInput = z.infer<typeof userSchema>;
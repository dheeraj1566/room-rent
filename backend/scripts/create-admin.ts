import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../src/models/User";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123";
const ADMIN_NAME = (process.env.ADMIN_NAME || "Admin User").trim();
const ADMIN_PHONE = (process.env.ADMIN_PHONE || "9999999999").trim();

async function createOrUpdateAdmin() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is not set. Add it to backend/.env before running this script.");
  }

  await mongoose.connect(mongoUri);

  const existingByEmail = await User.findOne({ email: ADMIN_EMAIL });
  if (existingByEmail) {
    existingByEmail.fullName = ADMIN_NAME;
    existingByEmail.phone = ADMIN_PHONE;
    existingByEmail.passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    existingByEmail.role = "admin";
    existingByEmail.isVerified = true;
    existingByEmail.isActive = true;
    await existingByEmail.save();

    console.log(`Updated existing admin user: ${ADMIN_EMAIL}`);
    return;
  }

  const existingByPhone = await User.findOne({ phone: ADMIN_PHONE });
  if (existingByPhone) {
    throw new Error(
      `Phone ${ADMIN_PHONE} is already used by another account (${existingByPhone.email || "no email"}). Set ADMIN_PHONE to a different value and try again.`,
    );
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await User.create({
    fullName: ADMIN_NAME,
    email: ADMIN_EMAIL,
    phone: ADMIN_PHONE,
    passwordHash,
    gender: "Other",
    isVerified: true,
    isActive: true,
    role: "admin",
  });

  console.log(`Created admin user: ${ADMIN_EMAIL}`);
}

createOrUpdateAdmin()
  .catch((error) => {
    console.error("Failed to create admin user:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

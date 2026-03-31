import type { Request, Response, NextFunction } from "express";

import type { UserIdParam, UserInput } from "@rent/shared";
import { createUserRecord, getUserRecord, updateUserRecord } from "../services/user.service";

type MinimalUserInput = {
  userName: string;
  phone: string;
  localAddress: string;
};

function toPersistedUser(input: MinimalUserInput): UserInput {
  const digits = input.phone.replace(/\D/g, "");
  const normalizedPhone = input.phone.startsWith("+") ? input.phone : `+${digits}`;
  const safeAddress = input.localAddress.trim();

  return {
    userName: input.userName.trim(),
    phone: normalizedPhone,
    userEmail: `${digits}@rent.app`,
    aadhaarNumber: digits.padStart(12, "0").slice(-12),
    localAddress: safeAddress,
    hometownAddress: safeAddress,
    profilePhotoUrl: "https://example.com/profile.png"
  };
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = toPersistedUser(req.body as MinimalUserInput);
    await createUserRecord(user);

    return res.status(201).json({
      message: "User saved successfully"
    });
  } catch (error) {
    return next(error);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params as UserIdParam;
    const user = await getUserRecord(userId);

    return res.status(200).json({
      message: "User fetched successfully",
      user
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params as UserIdParam;
    const user = toPersistedUser(req.body as MinimalUserInput);

    await updateUserRecord(userId, user);

    return res.status(200).json({
      message: "User updated successfully"
    });
  } catch (error) {
    return next(error);
  }
}

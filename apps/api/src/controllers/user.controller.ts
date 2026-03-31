import type { Request, Response, NextFunction } from "express";

import type { UserIdParam, UserInput } from "@rent/shared";
import { createUserRecord, getUserRecord, updateUserRecord } from "../services/user.service";

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.body as UserInput;
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
    const user = req.body as UserInput;

    await updateUserRecord(userId, user);

    return res.status(200).json({
      message: "User updated successfully"
    });
  } catch (error) {
    return next(error);
  }
}
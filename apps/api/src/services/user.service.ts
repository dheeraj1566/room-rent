import { getUserById, saveUser, updateUser } from "@rent/db";
import type { UserInput } from "@rent/shared";

export async function createUserRecord(user: UserInput) {
  await saveUser(user);
}

export async function updateUserRecord(userId: string, user: UserInput) {
  await updateUser(userId, user);
}

export async function getUserRecord(userId: string) {
  return getUserById(userId);
}
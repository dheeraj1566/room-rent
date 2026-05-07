/**
 * Simple error handling utilities
 * Standardized error responses and handling
 */
import type { Response } from "express";

/**
 * Check if error is a MongoDB duplicate key error
 */
export function isDuplicateKeyError(error: any): { field: string } | null {
  if (error?.code === 11000 && error?.keyPattern) {
    const field = Object.keys(error.keyPattern)[0] ?? "unknown";
    return { field };
  }
  return null;
}

/**
 * Standard error responses to keep consistency
 */
export const ErrorResponses = {
  unauthorized: (res: Response) => 
    res.status(401).json({ error: "Unauthorized" }),
  badRequest: (res: Response, message?: string) => 
    res.status(400).json({ error: message ?? "Bad request" }),
  notFound: (res: Response, message?: string) => 
    res.status(404).json({ error: message ?? "Not found" }),
  conflict: (res: Response, message?: string) => 
    res.status(409).json({ error: message ?? "Conflict" }),
  forbidden: (res: Response, message?: string) => 
    res.status(403).json({ error: message ?? "Forbidden" }),
  internal: (res: Response, message?: string) => 
    res.status(500).json({ error: message ?? "Internal server error" }),

  // Specific auth errors
  invalidCredentials: (res: Response) => 
    res.status(401).json({ error: "Invalid credentials" }),
    
  accountDeactivated: (res: Response) => 
    res.status(403).json({ error: "Account is deactivated" }),
    
  emailExists: (res: Response) => 
    res.status(409).json({ error: "Email already registered" }),
    
  phoneExists: (res: Response) => 
    res.status(409).json({ error: "Phone already registered" })
};

/**
 * Handle duplicate key errors consistently
 */
export function handleDuplicateError(error: any, res: Response): boolean {
  const duplicate = isDuplicateKeyError(error);
  if (duplicate) {
    if (duplicate.field === "email") {
      ErrorResponses.emailExists(res);
      return true;
    }
    if (duplicate.field === "phone") {
      ErrorResponses.phoneExists(res);
      return true;
    }
    ErrorResponses.conflict(res, "Account already exists");
    return true;
  }
  return false;
}
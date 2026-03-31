import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

export function validateBody<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Validation failed",
        issues: result.error.issues
      });
    }

    req.body = result.data;
    return next();
  };
}

export function validateParams<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      return res.status(400).json({
        message: "Validation failed",
        issues: result.error.issues
      });
    }

    req.params = result.data as Request["params"];
    return next();
  };
}

export function validateQuery<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      return res.status(400).json({
        message: "Validation failed",
        issues: result.error.issues
      });
    }

    req.query = result.data as Request["query"];
    return next();
  };
}
import type { NextFunction, Request, Response } from "express";

type HttpError = Error & { statusCode?: number };

function isHttpError(error: unknown): error is HttpError {
  return error instanceof Error && typeof (error as HttpError).statusCode === "number";
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (isHttpError(err)) {
    const statusCode = err.statusCode ?? 500;

    if (statusCode >= 500) {
      console.error("Unhandled API error", err);
    } else {
      console.warn(`API request failed (${statusCode}): ${err.message}`);
    }

    return res.status(statusCode).json({
      message: err.message
    });
  }

  console.error("Unhandled API error", err);

  return res.status(500).json({
    message: "Internal server error"
  });
}
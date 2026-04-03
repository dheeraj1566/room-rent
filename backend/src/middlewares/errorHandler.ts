import type { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
  details?: {
    errorCode?: string;
    message?: string;
  };
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isAzureRestError =
    err.name === "RestError" ||
    Boolean(err.code) ||
    Boolean(err.details?.errorCode);

  const statusCode = err.statusCode || (isAzureRestError ? 502 : 500);
  const message = err.message || err.details?.message || "Internal Server Error";

  console.error(`[Error] ${statusCode} - ${message}`);

  res.status(statusCode).json({
    success: false,
    message,
    ...(isAzureRestError && {
      azureCode: err.code || err.details?.errorCode,
      azureMessage: err.details?.message || err.message,
    }),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const error: AppError = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

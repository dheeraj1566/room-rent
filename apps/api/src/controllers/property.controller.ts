import type { NextFunction, Request, Response } from "express";

import type { PropertyIdParam, PropertyInput, PropertyQuery } from "@rent/shared";
import {
  createPropertyRecord,
  deletePropertyRecord,
<<<<<<< HEAD
  getPropertyMetadataRecord,
=======
>>>>>>> 690f2eb6a173916d79eb7352294287178a80d61e
  getPropertyRecord,
  listPropertyRecords,
  updatePropertyRecord
} from "../services/property.service";

export async function createProperty(req: Request, res: Response, next: NextFunction) {
  try {
    const property = req.body as PropertyInput;
    await createPropertyRecord(property);

    return res.status(201).json({
      message: "Property added successfully"
    });
  } catch (error) {
    return next(error);
  }
}

<<<<<<< HEAD
export async function getPropertyMetadata(_req: Request, res: Response, next: NextFunction) {
  try {
    const metadata = await getPropertyMetadataRecord();

    return res.status(200).json({
      message: "Property metadata fetched successfully",
      metadata
    });
  } catch (error) {
    return next(error);
  }
}

=======
>>>>>>> 690f2eb6a173916d79eb7352294287178a80d61e
export async function listProperties(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.query as PropertyQuery;
    const properties = await listPropertyRecords(userId);

    return res.status(200).json({
      message: "Properties fetched successfully",
      properties
    });
  } catch (error) {
    return next(error);
  }
}

export async function getProperty(req: Request, res: Response, next: NextFunction) {
  try {
    const { propertyId } = req.params as PropertyIdParam;
    const property = await getPropertyRecord(propertyId);

    return res.status(200).json({
      message: "Property fetched successfully",
      property
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateProperty(req: Request, res: Response, next: NextFunction) {
  try {
    const { propertyId } = req.params as PropertyIdParam;
    const property = req.body as PropertyInput;

    await updatePropertyRecord(propertyId, property);

    return res.status(200).json({
      message: "Property updated successfully"
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteProperty(req: Request, res: Response, next: NextFunction) {
  try {
    const { propertyId } = req.params as PropertyIdParam;
    await deletePropertyRecord(propertyId);

    return res.status(200).json({
      message: "Property deleted successfully"
    });
  } catch (error) {
    return next(error);
  }
}

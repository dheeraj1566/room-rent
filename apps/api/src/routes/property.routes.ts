import { Router } from "express";

import { propertyIdParamSchema, propertyQuerySchema, propertySchema } from "@rent/shared";
import {
  createProperty,
  deleteProperty,
  getProperty,
  getPropertyMetadata,
  listProperties,
  updateProperty
} from "../controllers/property.controller";
import { validateBody, validateParams, validateQuery } from "../middlewares/validate.middleware";

const propertyRouter = Router();

propertyRouter.get("/properties/meta", getPropertyMetadata);
propertyRouter.post("/properties", validateBody(propertySchema), createProperty);
propertyRouter.get("/properties", validateQuery(propertyQuerySchema), listProperties);
propertyRouter.get("/properties/:propertyId", validateParams(propertyIdParamSchema), getProperty);
propertyRouter.put("/properties/:propertyId", validateParams(propertyIdParamSchema), validateBody(propertySchema), updateProperty);
propertyRouter.delete("/properties/:propertyId", validateParams(propertyIdParamSchema), deleteProperty);

export { propertyRouter };

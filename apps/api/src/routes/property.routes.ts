import { Router } from "express";

import { propertyIdParamSchema, propertyQuerySchema, propertySchema } from "@rent/shared";
import {
  createProperty,
  deleteProperty,
  getProperty,
  listProperties,
  updateProperty
} from "../controllers/property.controller";
import { validateBody, validateParams, validateQuery } from "../middlewares/validate.middleware";

const propertyRouter = Router();

propertyRouter.post("/properties", validateBody(propertySchema), createProperty);
propertyRouter.get("/properties", validateQuery(propertyQuerySchema), listProperties);
propertyRouter.get("/properties/:propertyId", validateParams(propertyIdParamSchema), getProperty);
propertyRouter.put("/properties/:propertyId", validateParams(propertyIdParamSchema), validateBody(propertySchema), updateProperty);
propertyRouter.delete("/properties/:propertyId", validateParams(propertyIdParamSchema), deleteProperty);

export { propertyRouter };

import { Router } from "express";

import { propertyIdParamSchema, propertyQuerySchema, propertySchema } from "@rent/shared";
import {
  createProperty,
  deleteProperty,
  getProperty,
<<<<<<< HEAD
  getPropertyMetadata,
=======
>>>>>>> 690f2eb6a173916d79eb7352294287178a80d61e
  listProperties,
  updateProperty
} from "../controllers/property.controller";
import { validateBody, validateParams, validateQuery } from "../middlewares/validate.middleware";

const propertyRouter = Router();

<<<<<<< HEAD
propertyRouter.get("/properties/meta", getPropertyMetadata);
=======
>>>>>>> 690f2eb6a173916d79eb7352294287178a80d61e
propertyRouter.post("/properties", validateBody(propertySchema), createProperty);
propertyRouter.get("/properties", validateQuery(propertyQuerySchema), listProperties);
propertyRouter.get("/properties/:propertyId", validateParams(propertyIdParamSchema), getProperty);
propertyRouter.put("/properties/:propertyId", validateParams(propertyIdParamSchema), validateBody(propertySchema), updateProperty);
propertyRouter.delete("/properties/:propertyId", validateParams(propertyIdParamSchema), deleteProperty);

export { propertyRouter };

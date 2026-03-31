import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";

import { getSetting } from "@rent/config";
import { swaggerDocument } from "./swagger";
import { errorHandler } from "./middlewares/error.middleware";
import { healthRouter } from "./routes/health.routes";
import { propertyRouter } from "./routes/property.routes";
import { userRouter } from "./routes/user.routes";

export function createApp() {
  const app = express();
  const corsOrigin = getSetting("CORS_ORIGIN") ?? "*";

  app.use(
    cors({
      origin: corsOrigin === "*" ? true : corsOrigin
    })
  );
  app.use(express.json());

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.get("/docs.json", (_req, res) => res.json(swaggerDocument));

  app.use(healthRouter);
  app.use(userRouter);
  app.use(propertyRouter);

  app.use(errorHandler);

  return { app, corsOrigin };
}
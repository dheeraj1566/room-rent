import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";

import env from "./config/env";
import swaggerSpec from "./config/swagger";
import { connectDB, disconnectDB } from "./config/db";
import routes from "./routes/index";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL || "https://roombaazi.com",
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/swagger.json", (_req, res) => {
  res.status(200).json(swaggerSpec);
});
app.get("/api/docs.json", (_req, res) => {
  res.status(200).json(swaggerSpec);
});

// Swagger UI routes (conventional + backward-compatible)
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// --------------- Routes ---------------
app.use("/api", routes);

// --------------- Error handling ---------------
app.use(notFoundHandler);
app.use(errorHandler);

// --------------- Start server ---------------
const start = async () => {
  try {
    // Connect to MongoDB Atlas
    await connectDB();

    app.listen(env.PORT, () => {
      console.log(
        `Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`
      );
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await disconnectDB();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnectDB();
  process.exit(0);
});

start();

export default app;

import express, { Express } from "express";
import { errorHandler } from "./middleware/errorHandler";
import { requestId } from "./middleware/requestId";
import { apiRouter } from "./routes";

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(requestId);

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "gq-backend" });
  });

  app.use("/api/gq", apiRouter);

  // Must be registered last - Express only treats a 4-arg function as an error handler.
  app.use(errorHandler);

  return app;
}

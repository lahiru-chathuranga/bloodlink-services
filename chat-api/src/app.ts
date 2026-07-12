import cors from "cors";
import express, { type Express } from "express";
import { errorHandler } from "./middleware/error-handler";
import chatRoutes from "./routes/chat.routes";
import healthRoutes from "./routes/health.routes";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(healthRoutes);
  app.use(chatRoutes);

  app.use(errorHandler);

  return app;
}

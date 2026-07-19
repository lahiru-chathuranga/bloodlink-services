import cors from "cors";
import express, { type Express } from "express";
import { errorHandler } from "./middleware/error-handler";
import chatRoutes from "./routes/chat.routes";
import healthRoutes from "./routes/health.routes";

export function createApp(): Express {
  const app = express();

  // Deployed behind a single reverse proxy (Render/Railway) that sets
  // X-Forwarded-For — without this, express-rate-limit refuses to trust that
  // header (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR) and throws on every
  // rate-limited request. `1` trusts exactly the immediate hop, not an
  // arbitrary chain, since the platform edge is the only proxy in front of us.
  app.set("trust proxy", 1);

  app.use(cors());
  app.use(express.json());

  app.use(healthRoutes);
  app.use(chatRoutes);

  app.use(errorHandler);

  return app;
}

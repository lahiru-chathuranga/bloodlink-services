import cors from "cors";
import express, { type Express } from "express";
import { errorHandler } from "./middleware/error-handler";
import adminRoutes from "./routes/admin.routes";
import authRoutes from "./routes/auth.routes";
import bookingsRoutes from "./routes/bookings.routes";
import donationsRoutes from "./routes/donations.routes";
import drivesRoutes from "./routes/drives.routes";
import healthRoutes from "./routes/health.routes";
import homeRoutes from "./routes/home.routes";
import referenceRoutes from "./routes/reference.routes";
import urgentRequestsRoutes from "./routes/urgent-requests.routes";
import usersRoutes from "./routes/users.routes";

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
  app.use(authRoutes);
  app.use(usersRoutes);
  app.use(homeRoutes);
  app.use(drivesRoutes);
  app.use(bookingsRoutes);
  app.use(donationsRoutes);
  app.use(urgentRequestsRoutes);
  app.use(referenceRoutes);
  app.use(adminRoutes);

  app.use(errorHandler);

  return app;
}

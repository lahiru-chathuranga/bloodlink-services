import cors from "cors";
import express, { type Express } from "express";
import { errorHandler } from "./middleware/error-handler";
import adminRoutes from "./routes/admin.routes";
import authRoutes from "./routes/auth.routes";
import bookingsRoutes from "./routes/bookings.routes";
import donationsRoutes from "./routes/donations.routes";
import drivesRoutes from "./routes/drives.routes";
import eligibilityRoutes from "./routes/eligibility.routes";
import healthRoutes from "./routes/health.routes";
import homeRoutes from "./routes/home.routes";
import referenceRoutes from "./routes/reference.routes";
import urgentRequestsRoutes from "./routes/urgent-requests.routes";
import usersRoutes from "./routes/users.routes";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(healthRoutes);
  app.use(authRoutes);
  app.use(usersRoutes);
  app.use(homeRoutes);
  app.use(drivesRoutes);
  app.use(eligibilityRoutes);
  app.use(bookingsRoutes);
  app.use(donationsRoutes);
  app.use(urgentRequestsRoutes);
  app.use(referenceRoutes);
  app.use(adminRoutes);

  app.use(errorHandler);

  return app;
}

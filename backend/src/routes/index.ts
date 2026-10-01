import { Router } from "express";
import { accountConfigRouter } from "../modules/accountConfig/accountConfig.routes";
import { authRouter } from "../modules/auth/auth.routes";
import { bookingRouter } from "../modules/booking/booking.routes";
import { channelRouter } from "../modules/channel/channel.routes";
import { monitoringRouter } from "../modules/monitoring/monitoring.routes";
import { propertyRouter } from "../modules/property/property.routes";
import { ratePlanRouter } from "../modules/ratePlan/ratePlan.routes";

/**
 * Mounted at /api/gq in app.ts. Add new module routers here as GQ grows - each module
 * stays self-contained (routes/service/schema) under src/modules/<name>.
 *
 * bookingRouter is the one exception to every route requiring a GQ session token -
 * it's mounted here with no `authenticate` middleware at all (see booking.routes.ts),
 * since POST /webhooks/channex must be callable by Channex itself, unauthenticated by
 * design and verified by its own shared-secret header instead.
 */
export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/properties", propertyRouter);
apiRouter.use("/rate-plans", ratePlanRouter);
apiRouter.use("/channels", channelRouter);
apiRouter.use("/webhooks", bookingRouter);
apiRouter.use("/account-config", accountConfigRouter);
apiRouter.use("/monitoring", monitoringRouter);

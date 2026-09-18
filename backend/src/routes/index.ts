import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes";
import { propertyRouter } from "../modules/property/property.routes";
import { ratePlanRouter } from "../modules/ratePlan/ratePlan.routes";

/**
 * Mounted at /api/gq in app.ts. Add new module routers here as GQ grows - each module
 * stays self-contained (routes/service/schema) under src/modules/<name>.
 */
export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/properties", propertyRouter);
apiRouter.use("/rate-plans", ratePlanRouter);

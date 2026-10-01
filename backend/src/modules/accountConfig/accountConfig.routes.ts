import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireAdmin } from "../../middleware/requireAdmin";
import { asyncHandler } from "../../middleware/asyncHandler";
import { createAccountConfigSchema } from "./accountConfig.schema";
import { createAccountConfig, listAccountConfigs } from "./accountConfig.service";

export const accountConfigRouter = Router();

accountConfigRouter.use(authenticate, requireAdmin);

accountConfigRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createAccountConfigSchema.parse(req.body);
    const result = await createAccountConfig(body, req.correlationId);
    res.status(201).json(result);
  })
);

accountConfigRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const accountConfigs = await listAccountConfigs();
    res.status(200).json({ accountConfigs });
  })
);

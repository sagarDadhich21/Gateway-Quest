import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireAdmin } from "../../middleware/requireAdmin";
import { asyncHandler } from "../../middleware/asyncHandler";
import {
  createAccountConfigSchema,
  accountConfigIdParamSchema,
  setAccountConfigActiveSchema,
} from "./accountConfig.schema";
import {
  createAccountConfig,
  listAccountConfigs,
  registerAccountConfigWithChannex,
  rotateAccountConfigSecret,
  setAccountConfigActive,
} from "./accountConfig.service";

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

accountConfigRouter.post(
  "/:accountConfigId/register-with-channex",
  asyncHandler(async (req, res) => {
    const { accountConfigId } = accountConfigIdParamSchema.parse(req.params);
    const result = await registerAccountConfigWithChannex(accountConfigId, req.correlationId);
    res.status(200).json(result);
  })
);

accountConfigRouter.post(
  "/:accountConfigId/rotate-secret",
  asyncHandler(async (req, res) => {
    const { accountConfigId } = accountConfigIdParamSchema.parse(req.params);
    const result = await rotateAccountConfigSecret(accountConfigId, req.correlationId);
    res.status(200).json(result);
  })
);

accountConfigRouter.patch(
  "/:accountConfigId/active",
  asyncHandler(async (req, res) => {
    const { accountConfigId } = accountConfigIdParamSchema.parse(req.params);
    const { isActive } = setAccountConfigActiveSchema.parse(req.body);
    const result = await setAccountConfigActive(accountConfigId, isActive, req.correlationId);
    res.status(200).json(result);
  })
);

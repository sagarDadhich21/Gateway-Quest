import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { logger } from "../../services/logger";
import { loginRequestSchema } from "./auth.schema";
import { login } from "./auth.service";

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginRequestSchema.parse(req.body);

    const result = await login(body.email, body.password, req.correlationId);

    logger.info("gq_login_success", {
      correlationId: req.correlationId,
      bqUserId: result.user.bqUserId,
    });

    res.status(200).json({
      token: result.token,
      expiresInMinutes: result.expiresInMinutes,
      user: result.user,
    });
  })
);

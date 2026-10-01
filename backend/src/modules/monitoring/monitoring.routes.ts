import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireAdmin } from "../../middleware/requireAdmin";
import { asyncHandler } from "../../middleware/asyncHandler";
import { listQuerySchema } from "./monitoring.schema";
import { listApiLogs, listErrorQueue, listPushTasks, listWebhookLogs } from "./monitoring.service";

export const monitoringRouter = Router();

monitoringRouter.use(authenticate, requireAdmin);

monitoringRouter.get(
  "/tasks",
  asyncHandler(async (req, res) => {
    const { limit } = listQuerySchema.parse(req.query);
    const tasks = await listPushTasks(limit);
    res.status(200).json({ tasks });
  })
);

monitoringRouter.get(
  "/api-logs",
  asyncHandler(async (req, res) => {
    const { limit } = listQuerySchema.parse(req.query);
    const apiLogs = await listApiLogs(limit);
    res.status(200).json({ apiLogs });
  })
);

monitoringRouter.get(
  "/webhook-log",
  asyncHandler(async (req, res) => {
    const { limit } = listQuerySchema.parse(req.query);
    const webhookLogs = await listWebhookLogs(limit);
    res.status(200).json({ webhookLogs });
  })
);

monitoringRouter.get(
  "/error-queue",
  asyncHandler(async (req, res) => {
    const { limit } = listQuerySchema.parse(req.query);
    const errors = await listErrorQueue(limit);
    res.status(200).json({ errors });
  })
);

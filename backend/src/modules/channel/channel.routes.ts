import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { asyncHandler } from "../../middleware/asyncHandler";
import { channelIdParamSchema, channelMappingIdParamSchema } from "./channel.schema";
import {
  activateChannel,
  deactivateChannel,
  deleteLocalMapping,
  getChannelDetails,
  listAndSyncMappings,
} from "./channel.service";

export const channelRouter = Router();

channelRouter.use(authenticate);

channelRouter.get(
  "/:channelId",
  asyncHandler(async (req, res) => {
    const { channelId } = channelIdParamSchema.parse(req.params);
    const channel = await getChannelDetails(req.user!, channelId, req.correlationId);
    res.status(200).json(channel);
  })
);

channelRouter.post(
  "/:channelId/activate",
  asyncHandler(async (req, res) => {
    const { channelId } = channelIdParamSchema.parse(req.params);
    const channel = await activateChannel(req.user!, channelId, req.correlationId);
    res.status(200).json(channel);
  })
);

channelRouter.post(
  "/:channelId/deactivate",
  asyncHandler(async (req, res) => {
    const { channelId } = channelIdParamSchema.parse(req.params);
    const channel = await deactivateChannel(req.user!, channelId, req.correlationId);
    res.status(200).json(channel);
  })
);

channelRouter.get(
  "/:channelId/mappings",
  asyncHandler(async (req, res) => {
    const { channelId } = channelIdParamSchema.parse(req.params);
    const mappings = await listAndSyncMappings(req.user!, channelId, req.correlationId);
    res.status(200).json({ mappings });
  })
);

channelRouter.delete(
  "/:channelId/mappings/:mappingId",
  asyncHandler(async (req, res) => {
    const { channelId, mappingId } = channelMappingIdParamSchema.parse(req.params);
    await deleteLocalMapping(req.user!, channelId, mappingId);
    res.status(204).send();
  })
);

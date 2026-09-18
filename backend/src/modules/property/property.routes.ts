import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { asyncHandler } from "../../middleware/asyncHandler";
import { onboardProperty } from "../channex/channex.service";
import { onboardRoomTypes } from "../channex/roomType.service";
import { propertyIdParamSchema } from "./property.schema";
import { getPropertyForUser } from "./property.service";

export const propertyRouter = Router();

propertyRouter.use(authenticate);

propertyRouter.get(
  "/:propertyId",
  asyncHandler(async (req, res) => {
    const { propertyId } = propertyIdParamSchema.parse(req.params);

    const property = await getPropertyForUser(req.user!, propertyId, req.correlationId);

    res.status(200).json(property);
  })
);

propertyRouter.post(
  "/:propertyId/onboard",
  asyncHandler(async (req, res) => {
    const { propertyId } = propertyIdParamSchema.parse(req.params);

    const result = await onboardProperty(req.user!, propertyId, req.correlationId);

    res.status(result.status === "already_onboarded" ? 200 : 201).json(result);
  })
);

propertyRouter.post(
  "/:propertyId/room-types/onboard",
  asyncHandler(async (req, res) => {
    const { propertyId } = propertyIdParamSchema.parse(req.params);

    const results = await onboardRoomTypes(req.user!, propertyId, req.correlationId);

    res.status(200).json({ roomTypes: results });
  })
);

import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { asyncHandler } from "../../middleware/asyncHandler";
import { ariDateRangeQuerySchema, pushAvailabilitySchema, pushRestrictionsSchema } from "../ari/ari.schema";
import { getAri, getAvailability, pushAvailability, pushRestrictions } from "../ari/ari.service";
import { onboardProperty } from "../channex/channex.service";
import { onboardRoomTypes } from "../channex/roomType.service";
import { propertyIdParamSchema } from "./property.schema";
import { getPropertyForUser, listRoomTypesForUser } from "./property.service";

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

propertyRouter.get(
  "/:propertyId/room-types",
  asyncHandler(async (req, res) => {
    const { propertyId } = propertyIdParamSchema.parse(req.params);

    const roomTypes = await listRoomTypesForUser(req.user!, propertyId, req.correlationId);

    res.status(200).json({ roomTypes });
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

propertyRouter.get(
  "/:propertyId/ari",
  asyncHandler(async (req, res) => {
    const { propertyId } = propertyIdParamSchema.parse(req.params);
    const query = ariDateRangeQuerySchema.parse(req.query);

    const result = await getAri(req.user!, propertyId, query, req.correlationId);

    res.status(200).json(result);
  })
);

propertyRouter.get(
  "/:propertyId/ari/availability",
  asyncHandler(async (req, res) => {
    const { propertyId } = propertyIdParamSchema.parse(req.params);
    const query = ariDateRangeQuerySchema.parse(req.query);

    const availability = await getAvailability(req.user!, propertyId, query, req.correlationId);

    res.status(200).json({ availability });
  })
);

propertyRouter.post(
  "/:propertyId/ari/restrictions",
  asyncHandler(async (req, res) => {
    const { propertyId } = propertyIdParamSchema.parse(req.params);
    const body = pushRestrictionsSchema.parse(req.body);

    const result = await pushRestrictions(req.user!, propertyId, body, req.correlationId);

    res.status(200).json(result);
  })
);

propertyRouter.post(
  "/:propertyId/ari/availability",
  asyncHandler(async (req, res) => {
    const { propertyId } = propertyIdParamSchema.parse(req.params);
    const body = pushAvailabilitySchema.parse(req.body);

    const result = await pushAvailability(req.user!, propertyId, body, req.correlationId);

    res.status(200).json(result);
  })
);

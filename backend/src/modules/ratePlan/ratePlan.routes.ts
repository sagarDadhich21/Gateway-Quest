import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { asyncHandler } from "../../middleware/asyncHandler";
import {
  createRatePlanSchema,
  listRatePlansQuerySchema,
  ratePlanIdParamSchema,
  updateRatePlanSchema,
} from "./ratePlan.schema";
import {
  createRatePlan,
  deleteRatePlan,
  getRatePlan,
  listRatePlansForUser,
  updateRatePlan,
} from "./ratePlan.service";

export const ratePlanRouter = Router();

ratePlanRouter.use(authenticate);

ratePlanRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listRatePlansQuerySchema.parse(req.query);
    const ratePlans = await listRatePlansForUser(req.user!, query);
    res.status(200).json({ ratePlans });
  })
);

ratePlanRouter.get(
  "/:ratePlanId",
  asyncHandler(async (req, res) => {
    const { ratePlanId } = ratePlanIdParamSchema.parse(req.params);
    const ratePlan = await getRatePlan(req.user!, ratePlanId);
    res.status(200).json(ratePlan);
  })
);

ratePlanRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createRatePlanSchema.parse(req.body);
    const { ratePlan, created } = await createRatePlan(req.user!, body, req.correlationId);
    res.status(created ? 201 : 200).json(ratePlan);
  })
);

ratePlanRouter.put(
  "/:ratePlanId",
  asyncHandler(async (req, res) => {
    const { ratePlanId } = ratePlanIdParamSchema.parse(req.params);
    const body = updateRatePlanSchema.parse(req.body);
    const ratePlan = await updateRatePlan(req.user!, ratePlanId, body, req.correlationId);
    res.status(200).json(ratePlan);
  })
);

ratePlanRouter.delete(
  "/:ratePlanId",
  asyncHandler(async (req, res) => {
    const { ratePlanId } = ratePlanIdParamSchema.parse(req.params);
    await deleteRatePlan(req.user!, ratePlanId);
    res.status(204).send();
  })
);

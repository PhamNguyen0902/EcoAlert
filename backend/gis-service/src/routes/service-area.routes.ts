import { Router } from "express";
import {
  asyncHandler,
  paginatedResponse,
  successResponse,
  requireVerifiedRoles,
  requireInternalService,
} from "@ecoalert/shared";
import { serviceAreaService as service } from "../services/service-area.service";
import { matchPointSchema } from "../dtos/service-area.dto";
const router = Router();
const pagination = (query: Record<string, unknown>) => ({
  page: Math.max(1, Number.parseInt(String(query.page), 10) || 1),
  limit: Math.min(
    100,
    Math.max(1, Number.parseInt(String(query.limit), 10) || 20),
  ),
});
router.post(
  "/internal/match",
  requireInternalService(["alert-service"]),
  asyncHandler(async (req, res) => {
    const p = matchPointSchema.parse(req.body);
    res.json(
      successResponse(await service.matchServiceArea(p.longitude, p.latitude)),
    );
  }),
);
router.get(
  "/mine",
  requireVerifiedRoles(["OFFICER"]),
  asyncHandler(async (req, res) => {
    const { page, limit } = pagination(req.query);
    const result = await service.list(page, limit, req.get("x-user-id"));
    res.json(paginatedResponse(result.items, result.total, page, limit));
  }),
);
router.use(requireVerifiedRoles(["ADMIN"]));
router.post(
  "/match",
  asyncHandler(async (req, res) => {
    const p = matchPointSchema.parse(req.body);
    res.json(
      successResponse(await service.matchServiceArea(p.longitude, p.latitude)),
    );
  }),
);
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit } = pagination(req.query);
    const r = await service.list(page, limit);
    res.json(paginatedResponse(r.items, r.total, page, limit));
  }),
);
router.post(
  "/",
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(
        successResponse(await service.create(req.body, req.get("x-user-id")!)),
      );
  }),
);
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(successResponse(await service.get(req.params.id)));
  }),
);
router.get(
  "/:id/overlaps",
  asyncHandler(async (req, res) => {
    res.json(successResponse(await service.overlaps(req.params.id)));
  }),
);
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(
      successResponse(
        await service.patch(req.params.id, req.body, req.get("x-user-id")!),
      ),
    );
  }),
);
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(
      successResponse(
        await service.patch(
          req.params.id,
          { isActive: false },
          req.get("x-user-id")!,
        ),
      ),
    );
  }),
);
router.put(
  "/:id/officers",
  asyncHandler(async (req, res) => {
    res.json(
      successResponse(
        await service.officers(req.params.id, req.body, req.get("x-user-id")!),
      ),
    );
  }),
);
export default router;

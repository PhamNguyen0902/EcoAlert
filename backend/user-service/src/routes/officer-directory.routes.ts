import { Router } from "express";
import { z } from "zod";
import {
  asyncHandler,
  requireInternalService,
  successResponse,
} from "@ecoalert/shared";
import { User } from "../models/user.model";
const router = Router();
router.post(
  "/officers/lookup",
  requireInternalService(["alert-service", "gis-service"]),
  asyncHandler(async (req, res) => {
    const parsed = z
      .object({
        ids: z
          .array(z.string().regex(/^[a-f\d]{24}$/i))
          .max(100)
          .optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(100),
      })
      .strict()
      .safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          success: false,
          message: "Yêu cầu danh sách cán bộ không hợp lệ",
        });
      return;
    }
    const input = parsed.data;
    const filter = input.ids
      ? { _id: { $in: input.ids } }
      : { role: "OFFICER", isDeleted: false };
    const [items, total] = await Promise.all([
      User.find(filter)
        .select("_id fullName email role isActive isDeleted")
        .sort({ _id: 1 })
        .skip(input.ids ? 0 : (input.page - 1) * input.limit)
        .limit(input.ids ? 100 : input.limit)
        .lean(),
      User.countDocuments(filter),
    ]);
    res.json(successResponse({ items, total }));
  }),
);
export default router;

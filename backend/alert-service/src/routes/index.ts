import { Router } from "express";
import { alertController } from "../controllers/alert.controller";
import { categoryController } from "../controllers/category.controller";
import { validate } from "../middlewares/validate.middleware";
import {
  addOfficerNoteSchema,
  assignOfficerSchema,
  closeAlertSchema,
  confirmArrivalSchema,
  createAlertSchema,
  resolveAlertSchema,
  reviewClassificationSchema,
  shiftLocationSchema,
  updateAlertSchema,
  updateAlertStatusSchema,
} from "../dtos/alert.dto";
import {
  asyncHandler,
  requireVerifiedRoles,
  successResponse,
} from "@ecoalert/shared";
import { officerAssignmentService } from "../services/officer-assignment.service";

const router = Router();

router.use(requireVerifiedRoles(["CITIZEN", "OFFICER", "ADMIN"]));

// Category Routes
router.get("/categories", asyncHandler(categoryController.getCategories));
router.get("/categories/:id", asyncHandler(categoryController.getCategoryById));
router.post("/categories", asyncHandler(categoryController.createCategory));
router.patch(
  "/categories/:id",
  asyncHandler(categoryController.updateCategory),
);
router.delete(
  "/categories/:id",
  asyncHandler(categoryController.deleteCategory),
);

// Alert Routes
router.get("/nearby-check", asyncHandler(alertController.checkNearbyAlerts));
router.post(
  "/officer/shifts/start",
  validate(shiftLocationSchema),
  asyncHandler(alertController.startShift),
);
router.post(
  "/officer/shifts/end",
  validate(shiftLocationSchema),
  asyncHandler(alertController.endShift),
);
router.get(
  "/officer/shifts/current",
  asyncHandler(alertController.getCurrentShift),
);
router.get(
  "/officer/shifts/history",
  asyncHandler(alertController.getShiftHistory),
);
router.get(
  "/officers/availability",
  requireVerifiedRoles(["ADMIN"]),
  asyncHandler(alertController.getOfficerAvailability),
);
router.post(
  "/",
  // kiểm tra dữ liệu của alert
  validate(createAlertSchema),
  asyncHandler(alertController.createAlert),
);
router.get("/", asyncHandler(alertController.getAlerts));
router.get("/officer/tasks", asyncHandler(alertController.getOfficerTasks));
router.get("/:id", asyncHandler(alertController.getAlertById));
router.get(
  "/:id/assignment-preview",
  requireVerifiedRoles(["ADMIN"]),
  asyncHandler(async (req, res) => {
    res.json(
      successResponse(
        await officerAssignmentService.preview(req.params.id, {
          id: req.headers["x-user-id"] as string,
          role: "ADMIN",
        }),
      ),
    );
  }),
);
router.post(
  "/:id/auto-assign",
  requireVerifiedRoles(["ADMIN"]),
  asyncHandler(async (req, res) => {
    res.json(
      successResponse(
        await officerAssignmentService.autoAssignOfficer(req.params.id, {
          id: req.headers["x-user-id"] as string,
          role: "ADMIN",
          correlationId: req.headers["x-request-id"] as string | undefined,
        }),
      ),
    );
  }),
);
router.post("/:id/confirm", asyncHandler(alertController.confirmAlert));
router.patch(
  "/:id",
  validate(updateAlertSchema),
  asyncHandler(alertController.updateAlert),
);
router.patch(
  "/:id/status",
  requireVerifiedRoles(["ADMIN"]),
  validate(updateAlertStatusSchema),
  asyncHandler(alertController.updateStatus),
);
router.post(
  "/:id/classification/review",
  validate(reviewClassificationSchema),
  asyncHandler(alertController.reviewClassification),
);
router.post(
  "/:id/assign",
  requireVerifiedRoles(["ADMIN"]),
  validate(assignOfficerSchema),
  asyncHandler(alertController.assignOfficer),
);
router.post("/:id/start", asyncHandler(alertController.startHandling));
router.post(
  "/:id/arrival",
  validate(confirmArrivalSchema),
  asyncHandler(alertController.confirmArrival),
);
router.post(
  "/:id/resolution",
  validate(resolveAlertSchema),
  asyncHandler(alertController.resolveIncident),
);
router.post(
  "/:id/close",
  validate(closeAlertSchema),
  asyncHandler(alertController.closeIncident),
);
router.post(
  "/:id/note",
  validate(addOfficerNoteSchema),
  asyncHandler(alertController.addOfficerNote),
);
router.patch("/:id/restore", asyncHandler(alertController.restoreAlert));
router.delete("/:id", asyncHandler(alertController.deleteAlert));

export default router;

import { z } from "zod";
import { booleanValid } from "@turf/boolean-valid";
import { kinks } from "@turf/kinks";
const position = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
const ring = z
  .array(position)
  .min(4)
  .max(2000)
  .refine(
    (r) =>
      r.length > 0 &&
      r[0][0] === r[r.length - 1][0] &&
      r[0][1] === r[r.length - 1][1],
    "Vòng polygon phải đóng kín",
  );
const polygon = z.array(ring).min(1).max(50);
export const areaGeometrySchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("Polygon"), coordinates: polygon }),
    z.object({
      type: z.literal("MultiPolygon"),
      coordinates: z.array(polygon).min(1).max(50),
    }),
  ])
  .superRefine((g, ctx) => {
    try {
      if (!booleanValid(g) || kinks(g).features.length)
        ctx.addIssue({
          code: "custom",
          message: "Polygon không hợp lệ hoặc tự cắt nhau",
        });
    } catch {
      ctx.addIssue({ code: "custom", message: "Polygon không hợp lệ" });
    }
  });
export const officerIdsSchema = z
  .array(
    z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .transform((id) => id.toLowerCase()),
  )
  .max(100)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Officer ID không được trùng",
  );
export const areaInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[\w-]+$/)
      .transform((s) => s.toUpperCase()),
    name: z.string().trim().min(1).max(200),
    administrativeLevel: z.enum(["WARD", "DISTRICT", "CUSTOM"]),
    parentCode: z.string().trim().max(80).optional(),
    geometry: areaGeometrySchema,
    assignedOfficerIds: officerIdsSchema.default([]),
    isActive: z.boolean().default(true),
    priority: z.number().int().min(-1000).max(1000).default(0),
  })
  .strict();
export const areaPatchSchema = areaInputSchema.partial();
export const matchPointSchema = z
  .object({ longitude: position.items[0], latitude: position.items[1] })
  .strict();

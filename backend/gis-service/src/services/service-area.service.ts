import mongoose from "mongoose";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  internalServiceRequest,
  type AreaMatchResult,
  type OfficerDirectoryData,
} from "@ecoalert/shared";
import { z } from "zod";
import { ServiceArea } from "../models/service-area.model";
import {
  areaInputSchema,
  areaPatchSchema,
  matchPointSchema,
  officerIdsSchema,
} from "../dtos/service-area.dto";

export class ServiceAreaService {
  async validateOfficers(ids: string[]) {
    officerIdsSchema.parse(ids);
    if (!ids.length) return;
    const result = await internalServiceRequest<{
      items: OfficerDirectoryData[];
    }>(
      process.env.USER_SERVICE_URL || "http://localhost:3001",
      "/api/v1/internal/officers/lookup",
      "gis-service",
      { ids },
    );
    if (!Array.isArray(result.items))
      throw new BadRequestError("Không thể xác thực cán bộ");
    if (
      ids.some(
        (id) =>
          !result.items.some(
            (u) =>
              String(u._id) === id &&
              u.role === "OFFICER" &&
              u.isActive &&
              !u.isDeleted,
          ),
      )
    )
      throw new BadRequestError(
        "Tất cả cán bộ phải tồn tại, đang hoạt động và có vai trò OFFICER",
      );
  }
  async list(page = 1, limit = 20, officerId?: string) {
    const filter = officerId
      ? { assignedOfficerIds: officerId, isActive: true }
      : {};
    const [items, total] = await Promise.all([
      ServiceArea.find(filter)
        .sort({ code: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ServiceArea.countDocuments(filter),
    ]);
    return { items, total };
  }
  async get(id: string) {
    if (!mongoose.isValidObjectId(id))
      throw new NotFoundError("Không tìm thấy khu vực");
    const area = await ServiceArea.findById(id);
    if (!area) throw new NotFoundError("Không tìm thấy khu vực");
    return area;
  }
  async overlaps(id: string) {
    const area = await this.get(id);
    return ServiceArea.find({
      _id: { $ne: area._id },
      isActive: true,
      geometry: { $geoIntersects: { $geometry: area.geometry } },
    })
      .select("code name priority")
      .sort({ priority: -1, code: 1, _id: 1 })
      .limit(100)
      .lean();
  }
  async create(body: unknown, actorId: string) {
    const input = areaInputSchema.parse(body);
    await this.validateOfficers(input.assignedOfficerIds);
    try {
      return await ServiceArea.create({
        ...input,
        createdBy: actorId,
        updatedBy: actorId,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new ConflictError("Mã khu vực đã tồn tại");
      throw error;
    }
  }
  async patch(id: string, body: unknown, actorId: string) {
    await this.get(id);
    const input = areaPatchSchema.parse(body);
    if (input.assignedOfficerIds)
      await this.validateOfficers(input.assignedOfficerIds);
    try {
      return await ServiceArea.findByIdAndUpdate(
        id,
        { $set: { ...input, updatedBy: actorId } },
        { new: true, runValidators: true },
      );
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new ConflictError("Mã khu vực đã tồn tại");
      throw error;
    }
  }
  async officers(id: string, body: unknown, actorId: string) {
    const { officerIds } = z
      .object({ officerIds: officerIdsSchema })
      .strict()
      .parse(body);
    return this.patch(id, { assignedOfficerIds: officerIds }, actorId);
  }
  async matchServiceArea(
    longitude: number,
    latitude: number,
  ): Promise<AreaMatchResult> {
    matchPointSchema.parse({ longitude, latitude });
    // MongoDB handles spherical containment, holes and boundary points. No reverse-geocoder heuristic.
    const matches = await ServiceArea.find({
      isActive: true,
      geometry: {
        $geoIntersects: {
          $geometry: { type: "Point", coordinates: [longitude, latitude] },
        },
      },
    })
      .sort({ priority: -1, code: 1, _id: 1 })
      .limit(101)
      .lean();
    if (matches.length > 100)
      throw new ConflictError(
        "Quá nhiều khu vực chồng lấn; cần Admin chỉnh lại địa giới",
      );
    return {
      area: matches[0] ? { ...matches[0], _id: String(matches[0]._id) } : null,
      overlaps: matches.map((a) => ({
        _id: String(a._id),
        code: a.code,
        name: a.name,
        priority: a.priority,
      })),
    };
  }
}
export const serviceAreaService = new ServiceAreaService();

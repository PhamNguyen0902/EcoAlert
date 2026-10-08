import {
  BadRequestError,
  NotFoundError,
  internalServiceRequest,
  type OfficerDirectoryData,
} from "@ecoalert/shared";
import { envConfig } from "../config/env.config";
import type { WorkflowActor } from "./alert.service";
export type UserDirectoryItem = OfficerDirectoryData;
export class UserDirectoryService {
  private async lookup(body: { ids?: string[]; page?: number }) {
    return internalServiceRequest<{
      items: UserDirectoryItem[];
      total: number;
    }>(
      envConfig.userServiceUrl,
      "/api/v1/internal/officers/lookup",
      "alert-service",
      body,
    );
  }
  async requireOfficer(
    userId: string,
    _actor: WorkflowActor,
  ): Promise<UserDirectoryItem> {
    const result = await this.lookup({ ids: [userId] });
    const officer = result.items.find((u) => String(u._id) === userId);
    if (!officer || officer.isDeleted)
      throw new NotFoundError("Officer not found");
    if (officer.role !== "OFFICER" || !officer.isActive)
      throw new BadRequestError("Selected user must be an active OFFICER");
    return officer;
  }
  async listOfficers(
    _actor: WorkflowActor,
    ids?: string[],
  ): Promise<UserDirectoryItem[]> {
    if (ids) return (await this.lookup({ ids })).items;
    const items: UserDirectoryItem[] = [];
    for (let page = 1; page <= 100; page++) {
      const result = await this.lookup({ page });
      items.push(...result.items);
      if (!result.items.length || items.length >= result.total) return items;
    }
    throw new BadRequestError(
      "Too many Officers; narrow the area candidate pool",
    );
  }
}
export const userDirectoryService = new UserDirectoryService();

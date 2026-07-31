import { BadRequestError, NotFoundError } from '@ecoalert/shared';
import { envConfig } from '../config/env.config';
import type { WorkflowActor } from './alert.service';

interface UserLookupResponse {
  data?: {
    role?: unknown;
  };
}

export class UserDirectoryService {
  private readonly baseUrl = envConfig.userServiceUrl.replace(/\/$/, '');

  async requireOfficer(userId: string, actor: WorkflowActor): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/v1/users/${encodeURIComponent(userId)}`, {
        headers: {
          'x-user-id': actor.id,
          'x-user-role': actor.role,
          ...(actor.correlationId ? { 'x-request-id': actor.correlationId } : {}),
        },
      });
    } catch {
      throw new Error('Unable to verify the selected officer');
    }

    if (response.status === 404) {
      throw new NotFoundError('Officer not found');
    }
    if (!response.ok) {
      throw new Error('Unable to verify the selected officer');
    }

    const body = await response.json() as UserLookupResponse;
    if (body.data?.role !== 'OFFICER') {
      throw new BadRequestError('Selected user must have the OFFICER role');
    }
  }
}

export const userDirectoryService = new UserDirectoryService();

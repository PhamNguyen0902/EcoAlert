export type AssistantRole = 'CITIZEN' | 'OFFICER' | 'ADMIN';

export interface AuthorizedActor {
  userId: string;
  role: AssistantRole;
  requestId?: string;
}

export type AssistantIntent =
  | 'HOW_TO_REPORT'
  | 'REPORT_STATUS'
  | 'ASSIGNED_TASKS'
  | 'SYSTEM_OVERVIEW'
  | 'WRITE_REQUEST'
  | 'GENERAL';

export interface AssistantSource {
  id: string;
  title: string;
  href?: string;
  type: 'knowledge' | 'dynamic';
}

export interface AssistantMessageDto {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  sources: AssistantSource[];
  createdAt: string;
}

export interface AssistantConversationDto {
  id: string;
  title: string;
  role: AssistantRole;
  lastMessageAt: string;
  createdAt: string;
}

export class AssistantHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AssistantHttpError';
  }
}

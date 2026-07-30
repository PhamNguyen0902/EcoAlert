import { AssistantIntent, AssistantRole } from './types';

// This is a strict server-owned allowlist, not model-selected function calling.
// Adding embedding search or another data source should extend this list first.
export const READ_ONLY_TOOLS = {
  incident_status: ['CITIZEN', 'OFFICER', 'ADMIN'],
  officer_assigned_tasks: ['OFFICER'],
  admin_system_overview: ['ADMIN'],
} as const;

export type ReadOnlyTool = keyof typeof READ_ONLY_TOOLS;

export const toolForIntent = (
  intent: AssistantIntent,
  role: AssistantRole,
): ReadOnlyTool | undefined => {
  if (intent === 'REPORT_STATUS') return 'incident_status';
  if (intent === 'ASSIGNED_TASKS' && role === 'OFFICER') return 'officer_assigned_tasks';
  if (intent === 'SYSTEM_OVERVIEW' && role === 'ADMIN') return 'admin_system_overview';
  return undefined;
};

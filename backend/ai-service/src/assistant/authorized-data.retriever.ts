import mongoose, { FilterQuery } from 'mongoose';
import { ReadOnlyAlert, IReadOnlyAlert } from '../models/alert-read.model';
import { assistantRedis } from '../services/redis.service';
import { AssistantIntent, AssistantSource, AuthorizedActor } from './types';

export interface DynamicAssistantContext {
  text: string;
  sources: AssistantSource[];
}

const extractAlertId = (message: string): string | undefined => {
  const match = message.match(/\b[a-f\d]{24}\b/i)?.[0];
  return match && mongoose.isValidObjectId(match) ? match : undefined;
};

export const buildAlertAccessFilter = (
  actor: AuthorizedActor,
  alertId?: string,
): FilterQuery<IReadOnlyAlert> => {
  const filter: FilterQuery<IReadOnlyAlert> = { isDeleted: { $ne: true } };
  if (alertId) filter._id = new mongoose.Types.ObjectId(alertId);

  if (actor.role === 'CITIZEN') filter.citizenId = actor.userId;
  if (actor.role === 'OFFICER') filter.assignedOfficerId = actor.userId;
  return filter;
};

const destinationFor = (actor: AuthorizedActor, id: string): string => {
  if (actor.role === 'CITIZEN') return `/incidents/${id}`;
  if (actor.role === 'OFFICER') return `/officer/reports/${id}`;
  return `/admin/reports/${id}`;
};

type AlertSummary = {
  _id: { toString(): string };
  title: string;
  status?: string;
  severity?: string;
  updatedAt: Date;
};

const formatAlert = (
  alert: AlertSummary,
): string =>
  `${alert.title} (status: ${alert.status || 'pending'}, severity: ${
    alert.severity || 'not set'
  }, updated: ${alert.updatedAt.toISOString().slice(0, 10)})`;

const incidentContext = async (
  actor: AuthorizedActor,
  message: string,
): Promise<DynamicAssistantContext> => {
  const alertId = extractAlertId(message);
  const normalizedMessage = message.toLocaleLowerCase();
  const asksForLatest = ['latest', 'most recent', 'gần nhất', 'mới nhất'].some((phrase) =>
    normalizedMessage.includes(phrase),
  );
  const alerts = (await ReadOnlyAlert.find(buildAlertAccessFilter(actor, alertId))
    .select('title status severity updatedAt')
    .sort({ updatedAt: -1 })
    .limit(alertId || asksForLatest ? 1 : 5)
    .lean()) as unknown as AlertSummary[];

  if (alerts.length === 0) {
    return {
      text: 'No accessible incident records matched this request. I cannot reveal whether an incident belongs to another user.',
      sources: [],
    };
  }

  return {
    text: `Authorized incident context (${alerts.length} record${alerts.length === 1 ? '' : 's'}): ${alerts
      .map(formatAlert)
      .join('; ')}`,
    sources: alerts.map((alert) => ({
      id: `incident-${alert._id.toString()}`,
      title: `Incident: ${alert.title}`,
      href: destinationFor(actor, alert._id.toString()),
      type: 'dynamic' as const,
    })),
  };
};

const adminOverviewContext = async (): Promise<DynamicAssistantContext> => {
  const rows = await ReadOnlyAlert.aggregate<{ _id: string; count: number }>([
    { $match: { isDeleted: { $ne: true } } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const breakdown = rows
    .map((row) => `${row._id || 'pending'}: ${row.count}`)
    .join(', ');

  return {
    text: `Authorized system overview: ${total} active incidents. Status counts: ${breakdown || 'no active incidents'}.`,
    sources: [
      {
        id: 'admin-system-overview',
        title: 'Authorized incident status overview',
        href: '/admin/dashboard',
        type: 'dynamic',
      },
    ],
  };
};

export const retrieveAuthorizedData = async (
  actor: AuthorizedActor,
  intent: AssistantIntent,
  message: string,
): Promise<DynamicAssistantContext | undefined> => {
  const alertId = extractAlertId(message) || 'recent';
  const cacheKey = `assistant:context:v1:${actor.role}:${actor.userId}:${intent}:${alertId}`;
  const cached = await assistantRedis.getJson<DynamicAssistantContext>(cacheKey);
  if (cached) return cached;

  let context: DynamicAssistantContext | undefined;
  if (intent === 'REPORT_STATUS') context = await incidentContext(actor, message);
  if (intent === 'ASSIGNED_TASKS' && actor.role === 'OFFICER') {
    context = await incidentContext(actor, message);
  }
  if (intent === 'SYSTEM_OVERVIEW' && actor.role === 'ADMIN') {
    context = await adminOverviewContext();
  }

  if (context) await assistantRedis.setJson(cacheKey, context, 20);
  return context;
};

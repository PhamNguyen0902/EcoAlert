import { AssistantRole, AssistantSource } from './types';

export interface KnowledgeChunk {
  id: string;
  title: string;
  content: string;
  href: string;
  roles: AssistantRole[];
  keywords: string[];
}

// Preserve this small contract when moving from keyword matching to an
// embeddings/vector-store implementation.
export interface KnowledgeRetriever {
  retrieve(query: string, role: AssistantRole, limit?: number): KnowledgeChunk[];
}

const allRoles: AssistantRole[] = ['CITIZEN', 'OFFICER', 'ADMIN'];

export const KNOWLEDGE_BASE: KnowledgeChunk[] = [
  {
    id: 'reporting-an-incident',
    title: 'How to report an environmental incident',
    content:
      'Use Report incident to describe what you observed, choose the location, attach clear evidence when it is safe, review the details, and submit. The assistant cannot submit a report for you.',
    href: '/report',
    roles: allRoles,
    keywords: ['report', 'submit', 'incident', 'create', 'location', 'evidence', 'how'],
  },
  {
    id: 'report-evidence',
    title: 'Evidence and privacy guidance',
    content:
      'Only upload evidence you are allowed to share. Avoid exposing personal information, do not put yourself in danger, and use original photos or videos when possible. Evidence is used for incident review.',
    href: '/report',
    roles: allRoles,
    keywords: ['evidence', 'photo', 'video', 'privacy', 'safe', 'upload'],
  },
  {
    id: 'emergency-guidance',
    title: 'Urgent safety guidance',
    content:
      'For an immediate threat to life, fire, hazardous exposure, or an active disaster, contact local emergency services first. EcoAlert is for environmental reporting and does not replace emergency response.',
    href: '/report',
    roles: allRoles,
    keywords: ['emergency', 'danger', 'fire', 'hazard', 'urgent', 'life', 'safety'],
  },
  {
    id: 'incident-statuses',
    title: 'Understanding incident statuses',
    content:
      'Pending means the report is awaiting review. Verified means it passed review. Assigned and in progress indicate operational handling. Resolved indicates work was recorded, and closed means final review is complete.',
    href: '/my-reports',
    roles: allRoles,
    keywords: ['status', 'pending', 'verified', 'assigned', 'progress', 'resolved', 'closed'],
  },
  {
    id: 'citizen-report-tracking',
    title: 'Tracking your reports',
    content:
      'Citizens can view only their own reports and status history in My reports. The platform does not expose other citizens’ report details through the assistant.',
    href: '/my-reports',
    roles: ['CITIZEN'],
    keywords: ['my', 'reports', 'track', 'status', 'history'],
  },
  {
    id: 'officer-task-workflow',
    title: 'Officer task workflow',
    content:
      'Officers work only on assigned incidents. Open Assigned reports to start handling, confirm arrival where required, document resolution, and attach treatment evidence. The assistant explains workflow but cannot change it.',
    href: '/officer/assigned',
    roles: ['OFFICER'],
    keywords: ['assigned', 'task', 'arrival', 'resolve', 'workflow', 'officer', 'treatment'],
  },
  {
    id: 'admin-operations',
    title: 'Admin operations overview',
    content:
      'Admins can use reporting, analytics, user management, and audit areas to supervise operations. The assistant can summarize authorized aggregates but cannot assign, close, edit, or delete records.',
    href: '/admin/dashboard',
    roles: ['ADMIN'],
    keywords: ['admin', 'dashboard', 'analytics', 'queue', 'trend', 'audit', 'assign'],
  },
  {
    id: 'assistant-boundaries',
    title: 'EcoAlert AI Assistant boundaries',
    content:
      'The assistant is read-only. It can explain EcoAlert and retrieve only information the signed-in user is allowed to view. It does not create reports, modify incidents, assign staff, or send notifications.',
    href: '/assistant',
    roles: allRoles,
    keywords: ['assistant', 'read', 'only', 'write', 'change', 'assign', 'delete'],
  },
];

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'can', 'do', 'for', 'how', 'i', 'is', 'me', 'my', 'of',
  'the', 'to', 'what', 'with', 'you', 'và', 'là', 'tôi', 'của', 'cho', 'về',
]);

export const tokenize = (value: string): string[] =>
  value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));

export class KeywordKnowledgeRetriever implements KnowledgeRetriever {
  retrieve(query: string, role: AssistantRole, limit = 4): KnowledgeChunk[] {
    const tokens = new Set(tokenize(query));
    const eligible = KNOWLEDGE_BASE.filter((chunk) => chunk.roles.includes(role));
    const scored = eligible
      .map((chunk) => ({
        chunk,
        score: chunk.keywords.reduce(
          (score, keyword) =>
            score + (tokenize(keyword).some((token) => tokens.has(token)) ? 3 : 0),
          tokens.has(chunk.id.replace(/-/g, '')) ? 1 : 0,
        ),
      }))
      .sort((left, right) => right.score - left.score);

    const matches = scored.filter(({ score }) => score > 0).slice(0, limit);
    return (matches.length > 0 ? matches : scored.slice(0, Math.min(2, limit))).map(
      ({ chunk }) => chunk,
    );
  }
}

export const keywordKnowledgeRetriever = new KeywordKnowledgeRetriever();

export const retrieveKnowledge = (query: string, role: AssistantRole, limit = 4): KnowledgeChunk[] =>
  keywordKnowledgeRetriever.retrieve(query, role, limit);

export const knowledgeSources = (chunks: KnowledgeChunk[]): AssistantSource[] =>
  chunks.map((chunk) => ({
    id: chunk.id,
    title: chunk.title,
    href: chunk.href,
    type: 'knowledge',
  }));

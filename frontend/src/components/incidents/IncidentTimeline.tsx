import { format } from 'date-fns';
import {
  Bot,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Flag,
  Image as ImageIcon,
  MapPin,
  PlayCircle,
  UserCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AiAnalysisMode, AiVisionAnalysis, TimelineEntry } from '@/types';

interface IncidentTimelineProps {
  entries?: TimelineEntry[];
  createdAt: string;
  citizenId?: string;
  analysisMode?: AiAnalysisMode | null;
  vision?: AiVisionAnalysis | null;
}

const iconForEvent = (eventType: string) => {
  if (eventType.includes('AI_')) return Bot;
  if (eventType.includes('ASSIGNED')) return UserCheck;
  if (eventType.includes('STARTED')) return PlayCircle;
  if (eventType.includes('ARRIVED')) return MapPin;
  if (eventType.includes('EVIDENCE')) return ImageIcon;
  if (eventType.includes('RESOLVED')) return CheckCircle2;
  if (eventType.includes('CLOSED')) return Flag;
  if (eventType.includes('REPORTED')) return ClipboardCheck;
  return CircleDot;
};

export function IncidentTimeline({ entries = [], createdAt, citizenId, analysisMode, vision }: IncidentTimelineProps) {
  const normalizedEntries: TimelineEntry[] = entries.length > 0
    ? entries
    : [{
        eventType: 'INCIDENT_REPORTED',
        label: 'Incident reported',
        timestamp: createdAt,
        actorId: citizenId || 'citizen',
        actorRole: 'CITIZEN',
        status: 'pending',
      }];
  const sortedEntries = [...normalizedEntries].sort(
    (first, second) => new Date(first.timestamp).getTime() - new Date(second.timestamp).getTime(),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Incident Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative ml-3 border-l border-border">
          {sortedEntries.map((entry, index) => {
            const Icon = iconForEvent(entry.eventType);
            const legacyVisionOnly = entry.eventType === 'AI_ANALYSIS_COMPLETED' && analysisMode === 'VISION_ONLY';
            const label = legacyVisionOnly ? 'Vision analysis completed' : entry.label;
            const note = legacyVisionOnly
              ? `Semantic confidence: Not available${vision ? ` · Detected objects: ${vision.totalDetectedObjects}${vision.detectorConfidence !== null ? ` · Detector confidence: ${Math.round(vision.detectorConfidence * 100)}%` : ''}` : ''}`
              : entry.note;
            return (
              <li key={entry._id || `${entry.eventType}-${entry.timestamp}-${index}`} className="relative mb-7 ml-7 last:mb-0">
                <span className="absolute -left-[2.35rem] flex h-8 w-8 items-center justify-center rounded-full border bg-background text-primary shadow-sm">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.actorRole === 'SYSTEM' ? 'System' : entry.actorRole.toLowerCase()}
                      {entry.actorId ? ` · ${entry.actorId}` : ''}
                    </p>
                  </div>
                  <time className="text-xs text-muted-foreground" dateTime={entry.timestamp}>
                    {format(new Date(entry.timestamp), 'PPp')}
                  </time>
                </div>
                {entry.status ? (
                  <Badge variant="outline" className="mt-2 capitalize">
                    {entry.status.replace(/_/g, ' ')}
                  </Badge>
                ) : null}
                {note ? <p className="mt-2 text-sm text-muted-foreground">{note}</p> : null}
                {entry.evidenceUrls?.length ? (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {entry.evidenceUrls.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="Timeline evidence" className="h-16 w-20 rounded-md border object-cover" />
                      </a>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

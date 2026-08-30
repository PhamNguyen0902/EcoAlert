import { format } from "date-fns";
import { enUS, vi } from "date-fns/locale";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TimelineEntry } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { getIncidentStatusLabel } from "@/lib/incident-presentation";

interface IncidentTimelineProps {
  entries?: TimelineEntry[];
  createdAt: string;
  citizenId?: string;
}
const iconForEvent = (eventType: string) => {
  if (eventType.includes("AI_")) return Bot;
  if (eventType.includes("ASSIGNED")) return UserCheck;
  if (eventType.includes("STARTED")) return PlayCircle;
  if (eventType.includes("ARRIVED")) return MapPin;
  if (eventType.includes("EVIDENCE")) return ImageIcon;
  if (eventType.includes("RESOLVED")) return CheckCircle2;
  if (eventType.includes("CLOSED")) return Flag;
  if (eventType.includes("REPORTED")) return ClipboardCheck;
  return CircleDot;
};

/** Renders the server-owned workflow history without client-generated AI stages. */
export function IncidentTimeline({
  entries = [],
  createdAt,
  citizenId,
}: IncidentTimelineProps) {
  const { language } = useLanguage();
  const text =
    language === "vi"
      ? {
          reported: "Đã gửi báo cáo sự cố",
          title: "Dòng thời gian sự cố",
          system: "Hệ thống",
          evidence: "Minh chứng trong dòng thời gian",
        }
      : {
          reported: "Incident reported",
          title: "Incident timeline",
          system: "System",
          evidence: "Timeline evidence",
        };
  const normalizedEntries: TimelineEntry[] = entries.length
    ? entries
    : [
        {
          eventType: "INCIDENT_REPORTED",
          label: text.reported,
          timestamp: createdAt,
          actorId: citizenId || "citizen",
          actorRole: "CITIZEN",
          status: "pending",
        },
      ];
  const sortedEntries = [...normalizedEntries].sort(
    (first, second) =>
      new Date(first.timestamp).getTime() -
      new Date(second.timestamp).getTime(),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{text.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative ml-3 border-l border-border">
          {sortedEntries.map((entry, index) => {
            const Icon = iconForEvent(entry.eventType);
            return (
              <li
                key={
                  entry._id || `${entry.eventType}-${entry.timestamp}-${index}`
                }
                className="relative mb-7 ml-7 last:mb-0"
              >
                <span className="absolute -left-[2.35rem] flex h-8 w-8 items-center justify-center rounded-full border bg-background text-primary shadow-sm">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{entry.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.actorRole === "SYSTEM"
                        ? text.system
                        : entry.actorRole.toLowerCase()}
                      {/* không hiển thị objectID của các role */}
                      {/* {entry.actorId ? ` · ${entry.actorId}` : ""} */}
                    </p>
                  </div>
                  <time
                    className="text-xs text-muted-foreground"
                    dateTime={entry.timestamp}
                  >
                    {format(new Date(entry.timestamp), "PPp", {
                      locale: language === "vi" ? vi : enUS,
                    })}
                  </time>
                </div>
                {entry.status ? (
                  <Badge variant="outline" className="mt-2 capitalize">
                    {getIncidentStatusLabel(entry.status, language)}
                  </Badge>
                ) : null}
                {entry.note ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {entry.note}
                  </p>
                ) : null}
                {entry.evidenceUrls?.length ? (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {entry.evidenceUrls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={url}
                          alt={text.evidence}
                          className="h-16 w-20 rounded-md border object-cover"
                        />
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

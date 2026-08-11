import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CheckCircle2, CircleDot, Clock3 } from "lucide-react-native";
import type { Alert, TimelineEntry } from "../../types";
import { Card } from "../ui/Card";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";

const historyToTimeline = (alert: Alert): TimelineEntry[] =>
  (alert.statusHistory ?? []).map((entry) => ({
    _id: entry._id,
    eventType: "STATUS_CHANGED",
    label: entry.toStatus.replaceAll("_", " "),
    timestamp: entry.changedAt,
    actorId: entry.changedBy,
    actorRole: entry.changedByRole,
    note: entry.note,
    status: entry.toStatus,
    correlationId: entry.correlationId,
  }));

/** Renders only persisted backend timeline/history entries; it never invents workflow events. */
export const IncidentTimeline: React.FC<{ alert: Alert }> = ({ alert }) => {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const entries = useMemo(
    () => (alert.timeline?.length ? alert.timeline : historyToTimeline(alert))
      .filter((entry) => Boolean(entry.timestamp))
      .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()),
    [alert],
  );
  if (!entries.length) return null;
  const copy = language === "vi" ? { title: "Dòng thời gian xử lý", system: "Hệ thống" } : { title: "Incident timeline", system: "System" };
  return <Card style={styles.card}><View style={styles.header}><Clock3 size={18} color={colors.primary} /><Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text></View>{entries.map((entry, index) => <View key={entry._id || `${entry.eventType}-${entry.timestamp}-${index}`} style={styles.entry}><View style={styles.rail}><View style={[styles.dot, { backgroundColor: index === entries.length - 1 ? colors.primary : colors.border }]}>{index === entries.length - 1 ? <CheckCircle2 size={12} color="#FFF" /> : <CircleDot size={10} color={colors.textMuted} />}</View>{index < entries.length - 1 ? <View style={[styles.line, { backgroundColor: colors.border }]} /> : null}</View><View style={styles.entryCopy}><Text style={[styles.entryLabel, { color: colors.text }]}>{entry.label}</Text><Text style={[styles.entryMeta, { color: colors.textMuted }]}>{new Date(entry.timestamp).toLocaleString(language === "vi" ? "vi-VN" : "en-US")} · {entry.actorRole === "SYSTEM" ? copy.system : entry.actorRole}</Text>{entry.note ? <Text style={[styles.entryNote, { color: colors.textMuted }]}>{entry.note}</Text> : null}</View></View>)}</Card>;
};

const styles = StyleSheet.create({ card: { padding: 16, borderRadius: 18, marginBottom: 20 }, header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }, title: { fontSize: 16, fontWeight: "800" }, entry: { flexDirection: "row", minHeight: 58 }, rail: { width: 28, alignItems: "center" }, dot: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" }, line: { flex: 1, width: 2, marginVertical: 3 }, entryCopy: { flex: 1, paddingLeft: 5, paddingBottom: 12 }, entryLabel: { fontSize: 13, fontWeight: "800", textTransform: "capitalize" }, entryMeta: { fontSize: 10, marginTop: 3 }, entryNote: { fontSize: 11, lineHeight: 16, marginTop: 4 } });

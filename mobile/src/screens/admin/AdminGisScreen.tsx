import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Callout, Circle, Heatmap, Marker } from "react-native-maps";
import { AlertTriangle, ArrowLeft, Check, Filter, Layers3, RefreshCw, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { IncidentDensityPoint } from "../../types";
import { useCategories } from "../../hooks/useAlerts";
import { useIncidentDensity, useIncidentDensityDrilldown } from "../../hooks/useGis";
import { Badge } from "../../components/ui/Badge";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { SEVERITY_COLORS, STATUS_COLORS } from "../../utils/constants";

type MapMode = "HEATMAP" | "POINTS" | "COMBINED";
type TimeRange = "ALL" | "7D" | "30D";

const STATUS_OPTIONS = ["ALL", "ACTIVE", "PENDING", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const SEVERITY_OPTIONS = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
const DEFAULT_REGION = {
  latitude: 10.762622,
  longitude: 106.660172,
  latitudeDelta: 0.09,
  longitudeDelta: 0.09,
};

const dateFromRange = (range: TimeRange) => {
  if (range === "ALL") return undefined;
  const date = new Date();
  date.setDate(date.getDate() - (range === "7D" ? 7 : 30));
  return date.toISOString();
};

const hasValidCoordinates = (point: IncidentDensityPoint) =>
  Number.isFinite(point.lat) &&
  Number.isFinite(point.lng) &&
  point.lat >= -90 &&
  point.lat <= 90 &&
  point.lng >= -180 &&
  point.lng <= 180;

const displayValue = (value?: string) => value?.replaceAll("_", " ") || "—";

export const AdminGisScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { language, t } = useLanguage();
  const [mode, setMode] = useState<MapMode>("COMBINED");
  const [filterOpen, setFilterOpen] = useState(false);
  const [status, setStatus] = useState("ALL");
  const [severity, setSeverity] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [range, setRange] = useState<TimeRange>("ALL");
  const [selected, setSelected] = useState<IncidentDensityPoint | null>(null);
  const [drilldownCenter, setDrilldownCenter] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const categories = useCategories();

  const filters = useMemo<Record<string, string>>(() => {
    const from = dateFromRange(range);
    return {
      ...(status !== "ALL" ? { status: status.toLowerCase() } : {}),
      ...(severity !== "ALL" ? { severity: severity.toLowerCase() } : {}),
      ...(category !== "ALL" ? { category } : {}),
      ...(from ? { from } : {}),
    };
  }, [category, range, severity, status]);
  const density = useIncidentDensity(filters);
  const drilldown = useIncidentDensityDrilldown(drilldownCenter, filters);
  const points = useMemo(
    () => (density.data?.points ?? []).filter(hasValidCoordinates),
    [density.data?.points],
  );
  const initialRegion = useMemo(() => {
    const seed = points[0];
    return seed
      ? { ...DEFAULT_REGION, latitude: seed.lat, longitude: seed.lng }
      : DEFAULT_REGION;
  }, [points]);

  const copy = {
    title: t("admin.gisTitle"),
    subtitle: t("admin.gisSubtitle"),
    heatmap: t("admin.gisHeatmap"),
    points: t("admin.gisPoints"),
    combined: t("admin.gisCombined"),
    filter: t("admin.gisFilter"),
    filters: t("admin.gisFilters"),
    status: t("admin.gisStatus"),
    severity: t("admin.gisSeverity"),
    category: t("admin.gisCategory"),
    date: t("admin.gisDate"),
    all: t("admin.gisAll"),
    recent7: t("admin.gisRecent7"),
    recent30: t("admin.gisRecent30"),
    clear: t("admin.gisClear"),
    apply: t("admin.gisApply"),
    total: t("admin.gisTotal"),
    open: t("admin.gisOpen"),
    resolved: t("admin.gisResolved"),
    closed: t("admin.gisClosed"),
    noPoints: t("admin.gisNoPoints"),
    location: t("admin.gisLocation"),
    view: t("admin.gisViewDetails"),
    nearby: t("admin.gisNearby"),
    loading: t("admin.gisLoading"),
    tap: t("admin.gisTapHint"),
    unsupported: t("admin.gisIosDensityHint"),
    error: t("admin.gisError"),
    retry: t("admin.gisRetry"),
    incidentId: t("admin.gisIncidentId"),
    reported: t("admin.gisReported"),
    close: t("admin.gisClose"),
    nearbyError: t("admin.gisNearbyError"),
    back: t("admin.gisBack"),
  };
  const modeOptions: Array<{ id: MapMode; label: string }> = [
    { id: "HEATMAP", label: copy.heatmap },
    { id: "POINTS", label: copy.points },
    { id: "COMBINED", label: copy.combined },
  ];
  const showDensity = mode !== "POINTS";
  const showPoints = mode !== "HEATMAP";
  const formatReportedAt = (value?: string) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleString(language === "vi" ? "vi-VN" : "en-GB");
  };
  const selectPoint = (point: IncidentDensityPoint) => {
    setSelected(point);
    setDrilldownCenter({ latitude: point.lat, longitude: point.lng });
  };
  const resetFilters = () => {
    setStatus("ALL");
    setSeverity("ALL");
    setCategory("ALL");
    setRange("ALL");
  };
  const optionLabel = (value: string) =>
    value === "ALL" ? copy.all : value === "ACTIVE" ? copy.open : displayValue(value);
  const choose = (
    value: string,
    selectedValue: string,
    onChoose: (next: string) => void,
  ) => (
    <TouchableOpacity
      key={value}
      onPress={() => onChoose(value)}
      accessibilityRole="button"
      accessibilityState={{ selected: selectedValue === value }}
      style={[
        styles.option,
        {
          borderColor: selectedValue === value ? "#7C3AED" : colors.border,
          backgroundColor:
            selectedValue === value
              ? isDark
                ? "rgba(124,58,237,0.30)"
                : "#F3E8FF"
              : colors.surface,
        },
      ]}
    >
      <Text
        style={{
          color: selectedValue === value ? "#7C3AED" : colors.textMuted,
          fontWeight: "800",
          fontSize: 12,
        }}
      >
        {optionLabel(value)}
      </Text>
      {selectedValue === value ? <Check size={15} color="#7C3AED" /> : null}
    </TouchableOpacity>
  );
  const severityColor = (item: IncidentDensityPoint) =>
    SEVERITY_COLORS[item.severity || "low"]?.text || colors.primary;
  const statusStyle = (value?: string) =>
    STATUS_COLORS[(value || "PENDING").toUpperCase()] || {
      bg: colors.primaryLight,
      text: colors.primary,
      border: colors.border,
    };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[
            styles.headerButton,
            { backgroundColor: isDark ? "rgba(124,58,237,0.30)" : "#F3E8FF" },
          ]}
          accessibilityRole="button"
          accessibilityLabel={copy.back}
        >
          <ArrowLeft size={19} color="#7C3AED" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{copy.subtitle}</Text>
        </View>
        <TouchableOpacity
          onPress={() => density.refetch()}
          disabled={density.isRefetching}
          style={[
            styles.headerButton,
            { backgroundColor: isDark ? "rgba(124,58,237,0.30)" : "#F3E8FF" },
          ]}
          accessibilityRole="button"
          accessibilityLabel={copy.retry}
        >
          {density.isRefetching ? <ActivityIndicator color="#7C3AED" /> : <RefreshCw size={19} color="#7C3AED" />}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFilterOpen(true)}
          style={[
            styles.headerButton,
            { backgroundColor: isDark ? "rgba(124,58,237,0.30)" : "#F3E8FF" },
          ]}
          accessibilityRole="button"
          accessibilityLabel={copy.filter}
        >
          <Filter size={19} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.modeRow,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        {modeOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            onPress={() => setMode(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: option.id === mode }}
            style={[
              styles.modeButton,
              option.id === mode && {
                backgroundColor: isDark ? "rgba(124,58,237,0.30)" : "#F3E8FF",
              },
            ]}
          >
            <Layers3 size={15} color={option.id === mode ? "#7C3AED" : colors.textMuted} />
            <Text style={[styles.modeText, { color: option.id === mode ? "#7C3AED" : colors.textMuted }]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.mapWrap}>
        <MapView
          style={styles.map}
          initialRegion={initialRegion}
          onPress={(event) => {
            setSelected(null);
            setDrilldownCenter(event.nativeEvent.coordinate);
          }}
        >
          {showDensity && Platform.OS === "android" ? (
            <Heatmap
              points={points.map((point) => ({
                latitude: point.lat,
                longitude: point.lng,
                weight: point.weight,
              }))}
              radius={30}
              opacity={0.72}
              gradient={{
                colors: ["#60A5FA", "#FACC15", "#F97316", "#DC2626"],
                startPoints: [0.1, 0.38, 0.68, 1],
                colorMapSize: 128,
              }}
            />
          ) : null}
          {showDensity && Platform.OS !== "android"
            ? points.map((point) => (
                <Circle
                  key={`density-${point.incidentId}`}
                  center={{ latitude: point.lat, longitude: point.lng }}
                  radius={point.weight > 1 ? 310 : 230}
                  fillColor="rgba(220,38,38,0.16)"
                  strokeColor="rgba(249,115,22,0.36)"
                />
              ))
            : null}
          {selected && hasValidCoordinates(selected) ? (
            <Circle
              center={{ latitude: selected.lat, longitude: selected.lng }}
              radius={80}
              fillColor="rgba(124,58,237,0.08)"
              strokeColor="#7C3AED"
              strokeWidth={2}
            />
          ) : null}
          {showPoints
            ? points.map((point) => (
                <Marker
                  key={point.incidentId}
                  coordinate={{ latitude: point.lat, longitude: point.lng }}
                  pinColor={severityColor(point)}
                  zIndex={selected?.incidentId === point.incidentId ? 10 : 1}
                  onPress={() => selectPoint(point)}
                >
                  <Callout onPress={() => navigation.navigate("AlertDetail", { id: point.incidentId })}>
                    <View style={styles.callout}>
                      <Text style={styles.calloutTitle} numberOfLines={1}>
                        {point.title || point.incidentId}
                      </Text>
                      <Text style={styles.calloutCode} numberOfLines={1}>
                        {copy.incidentId}: {point.incidentId}
                      </Text>
                      <Text style={styles.calloutMeta} numberOfLines={1}>
                        {copy.category}: {displayValue(point.category)}
                      </Text>
                      <Text style={styles.calloutMeta} numberOfLines={1}>
                        {copy.severity}: {displayValue(point.severity)} · {copy.status}: {displayValue(point.status)}
                      </Text>
                      <Text style={styles.calloutMeta} numberOfLines={1}>
                        {copy.reported}: {formatReportedAt(point.createdAt)}
                      </Text>
                      <Text style={styles.calloutMeta} numberOfLines={1}>
                        {copy.location}: {point.address || "—"}
                      </Text>
                      <Text style={styles.calloutAction}>{copy.view}</Text>
                    </View>
                  </Callout>
                </Marker>
              ))
            : null}
        </MapView>

        {density.isLoading ? (
          <View style={[styles.overlayState, { backgroundColor: `${colors.background}E8` }]}>
            <ActivityIndicator color="#7C3AED" />
            <Text style={[styles.overlayText, { color: colors.textMuted }]}>{copy.loading}</Text>
          </View>
        ) : density.isError ? (
          <View style={[styles.overlayState, { backgroundColor: `${colors.background}E8` }]}>
            <AlertTriangle size={35} color={colors.destructive} />
            <Text style={[styles.overlayText, { color: colors.text }]}>{copy.error}</Text>
            <TouchableOpacity
              onPress={() => density.refetch()}
              style={styles.retryButton}
              accessibilityRole="button"
            >
              <Text style={styles.retryText}>{copy.retry}</Text>
            </TouchableOpacity>
          </View>
        ) : points.length === 0 ? (
          <View style={[styles.overlayState, { backgroundColor: `${colors.background}E8` }]}>
            <AlertTriangle size={35} color={colors.textMuted} />
            <Text style={[styles.overlayText, { color: colors.text }]}>{copy.noPoints}</Text>
          </View>
        ) : null}

        {showDensity && Platform.OS !== "android" ? (
          <View style={[styles.infoPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.infoText, { color: colors.textMuted }]}>{copy.unsupported}</Text>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.summary,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        {[
          { label: copy.total, value: density.data?.summary.total ?? 0, color: colors.text },
          { label: copy.open, value: density.data?.summary.open ?? 0, color: "#D97706" },
          { label: copy.resolved, value: density.data?.summary.resolved ?? 0, color: "#15803D" },
          { label: copy.closed, value: density.data?.summary.closed ?? 0, color: colors.textMuted },
        ].map((item) => (
          <View style={styles.summaryItem} key={item.label}>
            <Text style={[styles.summaryValue, { color: item.color }]}>{item.value}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{item.label}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>{copy.tap}</Text>

      {selected || drilldownCenter ? (
        <View style={[styles.drilldown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.drilldownHeader}>
            <View>
              <Text style={[styles.drilldownTitle, { color: colors.text }]}>
                {selected?.title || copy.nearby}
              </Text>
              <Text style={[styles.drilldownSubtitle, { color: colors.textMuted }]}>
                {drilldown.isLoading
                  ? copy.loading
                  : `${drilldown.data?.summary.total ?? 0} ${copy.nearby.toLowerCase()}`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setSelected(null);
                setDrilldownCenter(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={copy.close}
            >
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {drilldown.isError ? (
            <View style={styles.drilldownError}>
              <Text style={[styles.drilldownSubtitle, { color: colors.destructive }]}>{copy.nearbyError}</Text>
              <TouchableOpacity onPress={() => drilldown.refetch()} accessibilityRole="button">
                <Text style={styles.drilldownRetry}>{copy.retry}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            drilldown.data?.incidents.slice(0, 3).map((item) => {
              const itemStatus = statusStyle(item.status);
              return (
                <TouchableOpacity
                  key={item.alertId}
                  onPress={() => navigation.navigate("AlertDetail", { id: item.alertId })}
                  style={[styles.nearbyItem, { borderTopColor: colors.border }]}
                  accessibilityRole="button"
                >
                  <View style={styles.nearbyCopy}>
                    <Text style={[styles.nearbyTitle, { color: colors.text }]} numberOfLines={1}>
                      {item.title || item.alertId}
                    </Text>
                    <Text style={[styles.nearbyMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      {item.address || copy.location} · {displayValue(item.severity)} · {formatReportedAt(item.createdAt)}
                    </Text>
                    <Text style={styles.nearbyView}>{copy.view}</Text>
                  </View>
                  <Badge
                    label={displayValue(item.status)}
                    type="custom"
                    bgColor={itemStatus.bg}
                    textColor={itemStatus.text}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      ) : null}

      <Modal
        visible={filterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.filterSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>{copy.filters}</Text>
              <TouchableOpacity
                onPress={() => setFilterOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={copy.close}
              >
                <X size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.sheetLabel, { color: colors.text }]}>{copy.status}</Text>
              <View style={styles.options}>{STATUS_OPTIONS.map((item) => choose(item, status, setStatus))}</View>
              <Text style={[styles.sheetLabel, { color: colors.text }]}>{copy.severity}</Text>
              <View style={styles.options}>{SEVERITY_OPTIONS.map((item) => choose(item, severity, setSeverity))}</View>
              <Text style={[styles.sheetLabel, { color: colors.text }]}>{copy.category}</Text>
              <View style={styles.options}>
                {["ALL", ...(categories.data ?? []).filter((item) => item.isActive).map((item) => item.code)].map((item) =>
                  choose(item, category, setCategory),
                )}
              </View>
              <Text style={[styles.sheetLabel, { color: colors.text }]}>{copy.date}</Text>
              <View style={styles.options}>
                {[
                  { id: "ALL" as const, label: copy.all },
                  { id: "7D" as const, label: copy.recent7 },
                  { id: "30D" as const, label: copy.recent30 },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setRange(item.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: range === item.id }}
                    style={[
                      styles.option,
                      {
                        borderColor: range === item.id ? "#7C3AED" : colors.border,
                        backgroundColor:
                          range === item.id
                            ? isDark
                              ? "rgba(124,58,237,0.30)"
                              : "#F3E8FF"
                            : colors.surface,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: range === item.id ? "#7C3AED" : colors.textMuted,
                        fontWeight: "800",
                        fontSize: 12,
                      }}
                    >
                      {item.label}
                    </Text>
                    {range === item.id ? <Check size={15} color="#7C3AED" /> : null}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.sheetActions}>
              <TouchableOpacity
                onPress={resetFilters}
                style={[styles.clearButton, { borderColor: colors.border }]}
                accessibilityRole="button"
              >
                <Text style={{ color: colors.textMuted, fontWeight: "800" }}>{copy.clear}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFilterOpen(false)}
                style={styles.applyButton}
                accessibilityRole="button"
              >
                <Text style={styles.applyText}>{copy.apply}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  headerCopy: { flex: 1 },
  title: { fontSize: 20, fontWeight: "800" },
  subtitle: { marginTop: 2, fontSize: 11 },
  headerButton: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  modeRow: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  modeButton: { flex: 1, minHeight: 38, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  modeText: { fontSize: 11, fontWeight: "800" },
  mapWrap: { flex: 1, minHeight: 260 },
  map: { flex: 1 },
  overlayState: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 36 },
  overlayText: { textAlign: "center", fontSize: 13, fontWeight: "700" },
  retryButton: { borderRadius: 10, backgroundColor: "#7C3AED", paddingHorizontal: 15, paddingVertical: 9 },
  retryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  infoPill: { position: "absolute", left: 12, right: 12, bottom: 10, padding: 9, borderRadius: 11, borderWidth: 1 },
  infoText: { textAlign: "center", fontSize: 10, fontWeight: "600" },
  callout: { width: 230, padding: 5 },
  calloutTitle: { fontSize: 13, fontWeight: "800" },
  calloutCode: { marginTop: 4, fontSize: 10, fontWeight: "700", color: "#475569" },
  calloutMeta: { fontSize: 10, marginTop: 3, color: "#475569" },
  calloutAction: { alignSelf: "flex-start", marginTop: 8, borderRadius: 8, backgroundColor: "#7C3AED", paddingHorizontal: 9, paddingVertical: 5, color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  summary: { minHeight: 70, flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  summaryItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  summaryValue: { fontSize: 17, fontWeight: "900" },
  summaryLabel: { fontSize: 10, marginTop: 2, fontWeight: "600" },
  hint: { fontSize: 10, textAlign: "center", paddingHorizontal: 20, paddingVertical: 6 },
  drilldown: { marginHorizontal: 12, marginBottom: 10, padding: 13, borderRadius: 18, borderWidth: 1, maxHeight: 240 },
  drilldownHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  drilldownTitle: { maxWidth: 260, fontSize: 15, fontWeight: "800" },
  drilldownSubtitle: { marginTop: 2, fontSize: 11 },
  drilldownError: { paddingTop: 10 },
  drilldownRetry: { marginTop: 6, color: "#7C3AED", fontSize: 12, fontWeight: "800" },
  nearbyItem: { flexDirection: "row", alignItems: "center", gap: 9, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 9 },
  nearbyCopy: { flex: 1 },
  nearbyTitle: { fontSize: 12, fontWeight: "800" },
  nearbyMeta: { fontSize: 10, marginTop: 2 },
  nearbyView: { marginTop: 4, color: "#7C3AED", fontSize: 11, fontWeight: "800" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.45)" },
  filterSheet: { maxHeight: "82%", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sheetTitle: { fontSize: 19, fontWeight: "800" },
  sheetLabel: { fontSize: 13, fontWeight: "800", marginTop: 14, marginBottom: 8 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { minHeight: 38, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  clearButton: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 14 },
  applyButton: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#7C3AED" },
  applyText: { color: "#FFFFFF", fontWeight: "900" },
});

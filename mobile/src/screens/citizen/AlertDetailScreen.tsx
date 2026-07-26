import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import { ArrowLeft, MapPin, Calendar, ShieldCheck, AlertTriangle, Clock } from "lucide-react-native";
import { useAlert } from "../../hooks/useAlerts";
import { GlassCard } from "../../components/ui/GlassCard";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { COLORS, SEVERITY_COLORS } from "../../utils/constants";
import { format } from "date-fns";

export const AlertDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const alertId = route.params?.id;
  const { data: alert, isLoading, error } = useAlert(alertId);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading incident details...</Text>
      </View>
    );
  }

  if (error || !alert) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top }]}>
        <AlertTriangle size={48} color={COLORS.destructive} />
        <Text style={styles.errorTitle}>Report Not Found</Text>
        <Text style={styles.errorSub}>
          Could not fetch details for this alert. It may have been removed or unavailable.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coords = alert.location?.coordinates;
  const latitude = coords ? coords[1] : 10.762622;
  const longitude = coords ? coords[0] : 106.660172;
  const sevColor = SEVERITY_COLORS[alert.severity] || { bg: "#F1F5F9", text: "#475569" };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.circleBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
          <ArrowLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          Incident Details
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Category & Status Row */}
        <View style={styles.badgesRow}>
          <Badge
            label={alert.category?.toUpperCase().replace("_", " ") || "GENERAL"}
            type="custom"
            bgColor="#F1F5F9"
            textColor="#334155"
          />
          <View style={[styles.sevBadge, { backgroundColor: sevColor.bg }]}>
            <Text style={[styles.sevBadgeText, { color: sevColor.text }]}>
              {alert.severity?.toUpperCase()} PRIORITY
            </Text>
          </View>
          <Badge label={alert.status || "PENDING"} type="status" />
        </View>

        {/* Title & Description */}
        <Text style={styles.title}>{alert.title}</Text>

        <GlassCard style={styles.mainCard}>
          <Text style={styles.sectionHeading}>Description</Text>
          <Text style={styles.descriptionText}>{alert.description}</Text>
        </GlassCard>

        {/* Photos Gallery */}
        {alert.mediaUrls && alert.mediaUrls.length > 0 ? (
          <View style={styles.sectionBox}>
            <Text style={styles.sectionHeading}>Photos & Evidence</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
              {alert.mediaUrls.map((url, idx) => (
                <Image key={idx} source={{ uri: url }} style={styles.evidenceImage} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Location Map */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionHeading}>Location Geotag</Text>
          <Card style={styles.mapCard}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude,
                longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker coordinate={{ latitude, longitude }} title={alert.title} description={alert.address} />
            </MapView>
            <View style={styles.addressBox}>
              <MapPin size={16} color={COLORS.primary} />
              <Text style={styles.addressText} numberOfLines={2}>
                {alert.address || "Coordinates: " + latitude.toFixed(4) + ", " + longitude.toFixed(4)}
              </Text>
            </View>
          </Card>
        </View>

        {/* Officer Response / Verification Note */}
        {alert.officerNote ? (
          <GlassCard style={styles.officerNoteCard}>
            <View style={styles.officerHeader}>
              <ShieldCheck size={20} color={COLORS.primary} />
              <Text style={styles.officerTitle}>Environmental Officer Response</Text>
            </View>
            <Text style={styles.officerNoteContent}>{alert.officerNote}</Text>
          </GlassCard>
        ) : null}

        {/* Report Metadata */}
        <Card style={styles.metaCard}>
          <View style={styles.metaRow}>
            <Calendar size={16} color={COLORS.textMuted} />
            <Text style={styles.metaLabel}>Submitted on:</Text>
            <Text style={styles.metaValue}>
              {alert.createdAt ? format(new Date(alert.createdAt), "PPP - HH:mm") : "N/A"}
            </Text>
          </View>

          <View style={[styles.metaRow, { marginTop: 12 }]}>
            <Clock size={16} color={COLORS.textMuted} />
            <Text style={styles.metaLabel}>Last Updated:</Text>
            <Text style={styles.metaValue}>
              {alert.updatedAt ? format(new Date(alert.updatedAt), "PPP - HH:mm") : "N/A"}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, fontSize: 14, color: COLORS.textMuted, fontWeight: "500" },
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: COLORS.background },
  errorTitle: { fontSize: 20, fontWeight: "800", color: COLORS.text, marginTop: 16 },
  errorSub: { fontSize: 13, color: COLORS.textMuted, textAlign: "center", marginTop: 8, lineHeight: 18 },
  backBtn: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.primaryLight },
  backBtnText: { fontSize: 14, fontWeight: "700", color: COLORS.primaryDark },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    zIndex: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" },
  topBarTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  scrollContent: { padding: 20, paddingBottom: 40 },
  badgesRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  sevBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: "800", color: COLORS.text, marginBottom: 16, lineHeight: 28 },
  mainCard: { padding: 18, marginBottom: 20, borderRadius: 20 },
  sectionHeading: { fontSize: 15, fontWeight: "700", color: COLORS.text, marginBottom: 8 },
  descriptionText: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  sectionBox: { marginBottom: 20 },
  photoScroll: { marginTop: 4 },
  evidenceImage: { width: 140, height: 100, borderRadius: 14, marginRight: 10 },
  mapCard: { padding: 0, overflow: "hidden", marginTop: 4 },
  map: { width: "100%", height: 180 },
  addressBox: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: COLORS.surface, gap: 8 },
  addressText: { fontSize: 13, color: COLORS.text, flex: 1, fontWeight: "500" },
  officerNoteCard: { padding: 16, marginBottom: 20, borderRadius: 20, backgroundColor: COLORS.primaryLight },
  officerHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  officerTitle: { fontSize: 14, fontWeight: "700", color: COLORS.primaryDark },
  officerNoteContent: { fontSize: 13, color: COLORS.text, lineHeight: 20 },
  metaCard: { padding: 16 },
  metaRow: { flexDirection: "row", alignItems: "center" },
  metaLabel: { fontSize: 13, color: COLORS.textMuted, marginLeft: 8, width: 100 },
  metaValue: { fontSize: 13, color: COLORS.text, fontWeight: "600" },
});

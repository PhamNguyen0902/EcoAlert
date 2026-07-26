import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert as RNAlert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import {
  ArrowLeft,
  MapPin,
  ShieldCheck,
  CheckCircle,
  XCircle,
  PlayCircle,
  MessageSquare,
  AlertTriangle,
} from "lucide-react-native";
import { useAlert, useUpdateAlertStatus, useAddOfficerNote } from "../../hooks/useAlerts";
import { GlassCard } from "../../components/ui/GlassCard";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { COLORS, SEVERITY_COLORS } from "../../utils/constants";

const STATUS_ACTIONS = [
  { label: "Verify Report", status: "VERIFIED", icon: ShieldCheck, color: "#2563EB", bg: "#DBEAFE" },
  { label: "In Progress", status: "IN_PROGRESS", icon: PlayCircle, color: "#0284C7", bg: "#E0F2FE" },
  { label: "Mark Resolved", status: "RESOLVED", icon: CheckCircle, color: "#16A34A", bg: "#DCFCE7" },
  { label: "Reject Report", status: "REJECTED", icon: XCircle, color: "#DC2626", bg: "#FEE2E2" },
];

export const OfficerAlertDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const alertId = route.params?.id;
  const { data: alert, isLoading, error } = useAlert(alertId);

  const updateStatusMutation = useUpdateAlertStatus();
  const addNoteMutation = useAddOfficerNote();

  const [note, setNote] = useState("");

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
        <Text style={styles.loadingText}>Loading report for officer verification...</Text>
      </View>
    );
  }

  if (error || !alert) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top }]}>
        <AlertTriangle size={48} color={COLORS.destructive} />
        <Text style={styles.errorTitle}>Report Not Found</Text>
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

  const handleUpdateStatus = async (newStatus: string) => {
    RNAlert.alert(
      "Confirm Status Update",
      `Are you sure you want to set status to "${newStatus.replace("_", " ")}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              await updateStatusMutation.mutateAsync({
                id: alert._id,
                status: newStatus,
                officerNote: note.trim() || undefined,
              });
              RNAlert.alert("Success", "Incident status has been updated successfully.");
            } catch (err: any) {
              const msg = err.response?.data?.message || err.message || "Failed to update status.";
              RNAlert.alert("Update Error", msg);
            }
          },
        },
      ]
    );
  };

  const handleAddNote = async () => {
    if (!note.trim()) {
      RNAlert.alert("Validation Error", "Please write an officer response note first.");
      return;
    }

    try {
      await addNoteMutation.mutateAsync({ id: alert._id, note: note.trim() });
      RNAlert.alert("Note Saved", "Officer response note added successfully.");
      setNote("");
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to add note.";
      RNAlert.alert("Note Error", msg);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Navigation */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.circleBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Officer Verification</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Category & Status */}
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

        <Text style={styles.title}>{alert.title}</Text>

        {/* Officer Action Bar */}
        <Text style={styles.sectionHeading}>Update Incident Status</Text>
        <View style={styles.actionsGrid}>
          {STATUS_ACTIONS.map((act) => {
            const IconComp = act.icon;
            const isCurrent = alert.status?.toUpperCase() === act.status;
            return (
              <TouchableOpacity
                key={act.status}
                activeOpacity={0.8}
                style={[
                  styles.actionChip,
                  { backgroundColor: act.bg, borderColor: act.color },
                  isCurrent && styles.actionChipActive,
                ]}
                onPress={() => handleUpdateStatus(act.status)}
                disabled={updateStatusMutation.isPending}
              >
                <IconComp size={18} color={act.color} />
                <Text style={[styles.actionChipText, { color: act.color }]}>{act.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Officer Note Input */}
        <GlassCard style={styles.noteFormCard}>
          <Text style={styles.sectionHeading}>Officer Inspection Note / Remarks</Text>
          <Input
            placeholder="Enter verification result, dispatched team details, or resolution remarks..."
            multiline
            numberOfLines={3}
            style={styles.textArea}
            value={note}
            onChangeText={setNote}
          />
          <Button
            title="Save Officer Note"
            onPress={handleAddNote}
            loading={addNoteMutation.isPending}
            variant="outline"
            style={{ marginTop: 8 }}
            icon={<MessageSquare size={16} color={COLORS.secondary} style={{ marginRight: 6 }} />}
          />
        </GlassCard>

        {/* Incident Details Card */}
        <GlassCard style={styles.mainCard}>
          <Text style={styles.sectionHeading}>Citizen Incident Description</Text>
          <Text style={styles.descriptionText}>{alert.description}</Text>
        </GlassCard>

        {/* Evidence Photos */}
        {alert.mediaUrls && alert.mediaUrls.length > 0 ? (
          <View style={styles.sectionBox}>
            <Text style={styles.sectionHeading}>Photos & Evidence</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
              {alert.mediaUrls.map((url, idx) => (
                <Image key={idx} source={{ uri: url }} style={styles.evidenceImage} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Map View */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionHeading}>Incident Geotag Location</Text>
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
              <MapPin size={16} color={COLORS.secondary} />
              <Text style={styles.addressText} numberOfLines={2}>
                {alert.address || "Coordinates: " + latitude.toFixed(4) + ", " + longitude.toFixed(4)}
              </Text>
            </View>
          </Card>
        </View>

        {/* Response log history */}
        {alert.officerNote ? (
          <GlassCard style={styles.savedNoteCard}>
            <View style={styles.savedNoteHeader}>
              <ShieldCheck size={18} color={COLORS.secondary} />
              <Text style={styles.savedNoteTitle}>Logged Officer Note</Text>
            </View>
            <Text style={styles.savedNoteText}>{alert.officerNote}</Text>
          </GlassCard>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, fontSize: 14, color: COLORS.textMuted },
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorTitle: { fontSize: 20, fontWeight: "800", color: COLORS.text, marginTop: 16 },
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
  scrollContent: { padding: 20, paddingBottom: 50 },
  badgesRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  sevBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: "800", color: COLORS.text, marginBottom: 16, lineHeight: 28 },
  sectionHeading: { fontSize: 15, fontWeight: "700", color: COLORS.text, marginBottom: 10 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 6,
  },
  actionChipActive: { opacity: 0.9 },
  actionChipText: { fontSize: 13, fontWeight: "700" },
  noteFormCard: { padding: 18, marginBottom: 20, borderRadius: 20 },
  textArea: {},
  mainCard: { padding: 18, marginBottom: 20, borderRadius: 20 },
  descriptionText: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  sectionBox: { marginBottom: 20 },
  evidenceImage: { width: 140, height: 100, borderRadius: 14, marginRight: 10 },
  mapCard: { padding: 0, overflow: "hidden", marginTop: 4 },
  map: { width: "100%", height: 180 },
  addressBox: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: COLORS.surface, gap: 8 },
  addressText: { fontSize: 13, color: COLORS.text, flex: 1, fontWeight: "500" },
  savedNoteCard: { padding: 16, marginBottom: 20, borderRadius: 18, backgroundColor: "#E0F2FE" },
  savedNoteHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  savedNoteTitle: { fontSize: 14, fontWeight: "700", color: COLORS.secondary },
  savedNoteText: { fontSize: 13, color: COLORS.text, lineHeight: 20 },
});

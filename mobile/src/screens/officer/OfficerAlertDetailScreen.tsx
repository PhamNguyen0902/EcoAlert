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
  PlayCircle,
  MessageSquare,
  AlertTriangle,
  Navigation,
} from "lucide-react-native";
import {
  useAlert,
  useUpdateAlertStatus,
  useAddOfficerNote,
  useStartHandling,
  useConfirmArrival,
} from "../../hooks/useAlerts";
import { ResolutionModal } from "../../components/modals/ResolutionModal";
import { GlassCard } from "../../components/ui/GlassCard";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { COLORS, SEVERITY_COLORS } from "../../utils/constants";

export const OfficerAlertDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const alertId = route.params?.id;
  const { data: alert, isLoading, error } = useAlert(alertId);

  const updateStatusMutation = useUpdateAlertStatus();
  const addNoteMutation = useAddOfficerNote();
  const startHandlingMutation = useStartHandling();
  const confirmArrivalMutation = useConfirmArrival();

  const [note, setNote] = useState("");
  const [isResolutionModalOpen, setResolutionModalOpen] = useState(false);

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
        <Text style={styles.errorTitle}>Report Not Available</Text>
        <Text style={styles.errorSub}>
          This incident is not assigned to your Officer account or is no longer available.
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
  const currentStatus = alert.status?.toUpperCase();

  const handleStartHandling = async () => {
    try {
      await startHandlingMutation.mutateAsync(alert._id);
      RNAlert.alert("Workflow Started", "Incident status set to IN_PROGRESS.");
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to start handling.";
      RNAlert.alert("Error", msg);
    }
  };

  const handleConfirmArrival = async () => {
    try {
      await confirmArrivalMutation.mutateAsync({
        id: alert._id,
        location: { latitude, longitude },
      });
      RNAlert.alert("Arrival Confirmed", "Your GPS location arrival has been logged.");
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to confirm arrival.";
      RNAlert.alert("Error", msg);
    }
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
        <Text style={styles.topBarTitle}>Officer Task & Verification</Text>
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

        {/* Workflow Quick Action Buttons */}
        <Text style={styles.sectionHeading}>Officer Incident Actions</Text>
        <View style={styles.workflowGrid}>
          {currentStatus === "ASSIGNED" || currentStatus === "VERIFIED" || currentStatus === "PENDING" ? (
            <Button
              title="Step 1: Start Handling"
              onPress={handleStartHandling}
              loading={startHandlingMutation.isPending}
              style={styles.workflowBtn}
              icon={<PlayCircle size={18} color="#FFF" style={{ marginRight: 6 }} />}
            />
          ) : null}

          {currentStatus !== "RESOLVED" && currentStatus !== "CLOSED" ? (
            alert.arrivedAt ? (
              <View style={styles.arrivedBadge}>
                <CheckCircle size={16} color="#16A34A" />
                <Text style={styles.arrivedBadgeText}>Arrived at Scene</Text>
              </View>
            ) : (
              <Button
                title="Step 2: Confirm GPS Arrival"
                onPress={handleConfirmArrival}
                loading={confirmArrivalMutation.isPending}
                variant="outline"
                style={styles.workflowBtn}
                icon={<Navigation size={18} color={COLORS.secondary} style={{ marginRight: 6 }} />}
              />
            )
          ) : null}

          {currentStatus !== "RESOLVED" && currentStatus !== "CLOSED" ? (
            <Button
              title="Step 3: Mark Incident Resolved"
              onPress={() => setResolutionModalOpen(true)}
              style={[styles.workflowBtn, { backgroundColor: "#16A34A" }]}
              icon={<CheckCircle size={18} color="#FFF" style={{ marginRight: 6 }} />}
            />
          ) : null}
        </View>

        {/* Officer Note Input */}
        <GlassCard style={styles.noteFormCard}>
          <Text style={styles.sectionHeading}>Officer Inspection Note / Remarks</Text>
          <Input
            placeholder="Enter verification result, dispatched team details, or inspection note..."
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

      <ResolutionModal
        visible={isResolutionModalOpen}
        alertId={alert._id}
        onClose={() => setResolutionModalOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, fontSize: 14, color: COLORS.textMuted },
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
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
  },
  circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" },
  topBarTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  scrollContent: { padding: 20, paddingBottom: 50 },
  badgesRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  sevBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: "800", color: COLORS.text, marginBottom: 16, lineHeight: 28 },
  sectionHeading: { fontSize: 15, fontWeight: "700", color: COLORS.text, marginBottom: 10 },
  workflowGrid: { gap: 10, marginBottom: 20 },
  workflowBtn: { borderRadius: 14 },
  arrivedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  arrivedBadgeText: { fontSize: 13, fontWeight: "700", color: "#15803D" },
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

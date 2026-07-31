import React, { useState } from "react";
import {
  Alert as ReactNativeAlert,
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
import {
  ArrowLeft,
  MapPin,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  Clock,
  UserCheck,
  CheckSquare,
  Edit2,
  Trash2,
  RotateCcw,
} from "lucide-react-native";
import { useAlert, useAssignOfficer, useDeleteAlert, useRestoreAlert } from "../../hooks/useAlerts";
import { useProfile } from "../../hooks/useAuth";
import { useOfficers } from "../../hooks/useUsers";
import { OfficerPickerModal } from "../../components/admin/OfficerPickerModal";
import { CloseIncidentModal } from "../../components/modals/CloseIncidentModal";
import { EditAlertModal } from "../../components/modals/EditAlertModal";
import { GlassCard } from "../../components/ui/GlassCard";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { useTheme } from "../../context/ThemeContext";
import { SEVERITY_COLORS } from "../../utils/constants";
import type { User } from "../../types";
import { format } from "date-fns";

const getRequestErrorMessage = (error: unknown, fallback: string): string => {
  const requestError = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return requestError.response?.data?.message || requestError.message || fallback;
};

export const AlertDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const alertId = route.params?.id;
  const { data: alert, isLoading, error } = useAlert(alertId);
  const { data: profile } = useProfile();
  const assignOfficer = useAssignOfficer();
  const deleteAlertMutation = useDeleteAlert();
  const restoreAlertMutation = useRestoreAlert();

  const [isOfficerPickerOpen, setOfficerPickerOpen] = useState(false);
  const [isCloseModalOpen, setCloseModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);

  const normalizedStatus = alert?.status?.toUpperCase();
  const isAdmin = profile?.role?.toUpperCase() === "ADMIN";
  const citizenIdStr = typeof alert?.citizenId === "object" ? alert.citizenId._id : alert?.citizenId;
  const isOwnReport = profile?._id && citizenIdStr === profile._id;

  const canAssign =
    isAdmin &&
    normalizedStatus !== "RESOLVED" &&
    normalizedStatus !== "CLOSED" &&
    normalizedStatus !== "REJECTED";
  const canClose = (isOwnReport || isAdmin) && normalizedStatus === "RESOLVED";
  const canEdit = (isOwnReport || isAdmin) && normalizedStatus === "PENDING";
  const canDelete = isOwnReport || isAdmin;

  const {
    data: officerData,
    isLoading: isLoadingOfficers,
    isFetching: isFetchingOfficers,
    error: officersError,
    refetch: refetchOfficers,
  } = useOfficers(Boolean(canAssign || alert?.assignedOfficerId));

  const assignedOfficerObj = typeof alert?.assignedOfficerId === "object"
    ? alert.assignedOfficerId
    : officerData?.find((u) => u._id === alert?.assignedOfficerId);

  const officerDisplayName = assignedOfficerObj?.fullName ||
    (typeof alert?.assignedOfficerId === "string" ? `Cán bộ (${alert.assignedOfficerId.slice(-6)})` : undefined);

  const officers = (officerData ?? []).filter(
    (user) => user.role?.toUpperCase() === "OFFICER",
  );

  const handleAssignOfficer = (officer: User) => {
    if (!alert || !canAssign) return;

    assignOfficer.mutate(
      { id: alert._id, officerId: officer._id },
      {
        onSuccess: () => {
          setOfficerPickerOpen(false);
          ReactNativeAlert.alert(
            "Officer assigned",
            `${officer.fullName} has been assigned to this incident.`,
          );
        },
        onError: (mutationError) => {
          ReactNativeAlert.alert(
            "Unable to assign Officer",
            getRequestErrorMessage(mutationError, "Please refresh the incident and try again."),
          );
        },
      },
    );
  };

  const handleDeleteAlert = () => {
    if (!alert) return;
    ReactNativeAlert.alert(
      "Delete Incident Report",
      `Are you sure you want to delete report "${alert.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAlertMutation.mutateAsync(alert._id);
              ReactNativeAlert.alert("Deleted", "Incident report has been removed.");
              navigation.goBack();
            } catch (err: any) {
              ReactNativeAlert.alert("Delete Error", getRequestErrorMessage(err, "Failed to delete report."));
            }
          },
        },
      ]
    );
  };

  const handleRestoreAlert = async () => {
    if (!alert) return;
    try {
      await restoreAlertMutation.mutateAsync(alert._id);
      ReactNativeAlert.alert("Restored", "Incident report restored successfully.");
    } catch (err: any) {
      ReactNativeAlert.alert("Restore Error", getRequestErrorMessage(err, "Failed to restore report."));
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading incident details...</Text>
      </View>
    );
  }

  if (error || !alert) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <AlertTriangle size={48} color={colors.destructive} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Report Not Found</Text>
        <Text style={[styles.errorSub, { color: colors.textMuted }]}>
          Could not fetch details for this alert. It may have been removed or unavailable.
        </Text>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: isDark ? "rgba(22, 163, 74, 0.25)" : colors.primaryLight }]} onPress={() => navigation.goBack()}>
          <Text style={[styles.backBtnText, { color: isDark ? "#4ADE80" : colors.primaryDark }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coords = alert.location?.coordinates;
  const latitude = coords ? coords[1] : 10.762622;
  const longitude = coords ? coords[0] : 106.660172;
  const sevColor = SEVERITY_COLORS[alert.severity] || { bg: "#F1F5F9", text: "#475569" };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Bar */}
      <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={[styles.circleBtn, { backgroundColor: colors.background }]} onPress={() => navigation.goBack()} accessibilityRole="button">
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.text }]} numberOfLines={1}>
          Incident Details
        </Text>
        <View style={styles.topRightActions}>
          {canEdit ? (
            <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: colors.background }]} onPress={() => setEditModalOpen(true)}>
              <Edit2 size={18} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
          {canDelete ? (
            <TouchableOpacity style={[styles.iconActionBtn, { backgroundColor: colors.background }]} onPress={handleDeleteAlert}>
              <Trash2 size={18} color={isDark ? "#FCA5A5" : "#DC2626"} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Category & Status Row */}
        <View style={styles.badgesRow}>
          <Badge
            label={alert.category?.toUpperCase().replace("_", " ") || "GENERAL"}
            type="custom"
            bgColor={isDark ? "rgba(255,255,255,0.1)" : "#F1F5F9"}
            textColor={isDark ? colors.text : "#334155"}
          />
          <View style={[styles.sevBadge, { backgroundColor: sevColor.bg }]}>
            <Text style={[styles.sevBadgeText, { color: sevColor.text }]}>
              {alert.severity?.toUpperCase()} PRIORITY
            </Text>
          </View>
          <Badge label={alert.status || "PENDING"} type="status" />
          {alert.isAnonymous ? (
            <Badge label="ẨN DANH 👤" type="custom" bgColor={isDark ? "rgba(255,255,255,0.1)" : "#F1F5F9"} textColor={isDark ? colors.text : "#475569"} />
          ) : null}
          {alert.confirmationsCount && alert.confirmationsCount > 1 ? (
            <Badge label={`${alert.confirmationsCount} XÁC NHẬN 👍`} type="custom" bgColor={isDark ? "rgba(22,163,74,0.25)" : "#DCFCE7"} textColor={isDark ? "#86EFAC" : "#166534"} />
          ) : null}
          {alert.isDeleted ? (
            <Badge label="DELETED" type="custom" bgColor={isDark ? "rgba(220,38,38,0.25)" : "#FEE2E2"} textColor={isDark ? "#FCA5A5" : "#DC2626"} />
          ) : null}
        </View>

        {/* Title & Description */}
        <Text style={[styles.title, { color: colors.text }]}>{alert.title}</Text>

        {/* Close Incident Action Banner for Citizen */}
        {canClose ? (
          <GlassCard style={styles.closeCard}>
            <View style={styles.closeHeader}>
              <CheckSquare size={22} color="#16A34A" />
              <View style={{ flex: 1 }}>
                <Text style={styles.closeTitle}>Incident Marked Resolved</Text>
                <Text style={styles.closeSub}>
                  Officers have resolved this issue. Click below to verify and close the report.
                </Text>
              </View>
            </View>
            <Button
              title="Close Incident & Review"
              onPress={() => setCloseModalOpen(true)}
              style={styles.closeBtnAction}
            />
          </GlassCard>
        ) : null}

        {/* Restore Banner if soft-deleted (Admin) */}
        {alert.isDeleted && isAdmin ? (
          <View style={[styles.restoreCard, { backgroundColor: isDark ? "rgba(220,38,38,0.25)" : "#FEE2E2" }]}>
            <Text style={[styles.restoreText, { color: isDark ? "#FCA5A5" : "#DC2626" }]}>This incident report is soft-deleted.</Text>
            <Button
              title="Restore Report"
              onPress={handleRestoreAlert}
              loading={restoreAlertMutation.isPending}
              variant="outline"
              icon={<RotateCcw size={16} color={colors.primary} style={{ marginRight: 6 }} />}
            />
          </View>
        ) : null}

        <GlassCard style={styles.mainCard}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Description</Text>
          <Text style={[styles.descriptionText, { color: colors.text }]}>{alert.description}</Text>
        </GlassCard>

        {alert.assignedOfficerId ? (
          <Card style={[styles.assignedOfficerCard, { backgroundColor: isDark ? "rgba(79,70,229,0.2)" : "#EEF2FF", borderColor: isDark ? "rgba(79,70,229,0.4)" : "#C7D2FE" }]}>
            <View style={styles.assignmentHeader}>
              <View style={[styles.assignmentIcon, { backgroundColor: isDark ? "rgba(79,70,229,0.3)" : "#EEF2FF" }]}>
                <UserCheck size={22} color={isDark ? "#818CF8" : "#4F46E5"} />
              </View>
              <View style={styles.assignmentCopy}>
                <Text style={[styles.assignedOfficerLabel, { color: isDark ? "#818CF8" : "#4F46E5" }]}>Cán bộ chịu trách nhiệm</Text>
                <Text style={[styles.assignedOfficerName, { color: colors.text }]}>
                  {officerDisplayName || "Đã phân công Cán bộ"}
                </Text>
                {assignedOfficerObj?.email ? (
                  <Text style={[styles.assignedOfficerEmail, { color: colors.textMuted }]}>{assignedOfficerObj.email}</Text>
                ) : null}
              </View>
              {isAdmin && normalizedStatus !== "RESOLVED" && normalizedStatus !== "CLOSED" ? (
                <TouchableOpacity
                  style={[styles.reassignBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setOfficerPickerOpen(true)}
                >
                  <Text style={[styles.reassignBtnText, { color: colors.textMuted }]}>Thay đổi</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Card>
        ) : canAssign ? (
          <Card style={[styles.assignmentCard, { backgroundColor: isDark ? "rgba(124,58,237,0.2)" : "#FAF5FF", borderColor: isDark ? "rgba(124,58,237,0.4)" : "#DDD6FE" }]}>
            <View style={styles.assignmentHeader}>
              <View style={[styles.assignmentIcon, { backgroundColor: isDark ? "rgba(124,58,237,0.3)" : "#F3E8FF" }]}>
                <UserCheck size={22} color={isDark ? "#A78BFA" : "#7C3AED"} />
              </View>
              <View style={styles.assignmentCopy}>
                <Text style={[styles.assignmentTitle, { color: colors.text }]}>Assign to Officer</Text>
                <Text style={[styles.assignmentDescription, { color: colors.textMuted }]}>
                  Choose an Officer to take ownership of this incident.
                </Text>
              </View>
            </View>
            <Button
              title="Select Officer"
              onPress={() => setOfficerPickerOpen(true)}
              style={styles.assignmentButton}
              icon={<UserCheck size={18} color="#FFFFFF" />}
            />
          </Card>
        ) : null}

        {/* Photos Gallery */}
        {alert.mediaUrls && alert.mediaUrls.length > 0 ? (
          <View style={styles.sectionBox}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>Photos & Evidence</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
              {alert.mediaUrls.map((url, idx) => (
                <Image key={idx} source={{ uri: url }} style={styles.evidenceImage} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Location Map */}
        <View style={styles.sectionBox}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Location Geotag</Text>
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
            <View style={[styles.addressBox, { backgroundColor: colors.surface }]}>
              <MapPin size={16} color={colors.primary} />
              <Text style={[styles.addressText, { color: colors.text }]} numberOfLines={2}>
                {alert.address || "Coordinates: " + latitude.toFixed(4) + ", " + longitude.toFixed(4)}
              </Text>
            </View>
          </Card>
        </View>

        {/* Officer Response / Verification Note */}
        {alert.officerNote ? (
          <GlassCard style={styles.officerNoteCard}>
            <View style={styles.officerHeader}>
              <ShieldCheck size={20} color={colors.primary} />
              <Text style={[styles.officerTitle, { color: isDark ? "#4ADE80" : colors.primaryDark }]}>Environmental Officer Response</Text>
            </View>
            <Text style={[styles.officerNoteContent, { color: colors.text }]}>{alert.officerNote}</Text>
          </GlassCard>
        ) : null}

        {/* Report Metadata */}
        <Card style={styles.metaCard}>
          <View style={styles.metaRow}>
            <Calendar size={16} color={colors.textMuted} />
            <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Submitted on:</Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>
              {alert.createdAt ? format(new Date(alert.createdAt), "PPP - HH:mm") : "N/A"}
            </Text>
          </View>

          <View style={[styles.metaRow, { marginTop: 12 }]}>
            <Clock size={16} color={colors.textMuted} />
            <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Last Updated:</Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>
              {alert.updatedAt ? format(new Date(alert.updatedAt), "PPP - HH:mm") : "N/A"}
            </Text>
          </View>
        </Card>
      </ScrollView>

      <OfficerPickerModal
        visible={isOfficerPickerOpen && canAssign}
        officers={officers}
        isLoading={isLoadingOfficers}
        isRefreshing={isFetchingOfficers && !isLoadingOfficers}
        isAssigning={assignOfficer.isPending}
        errorMessage={
          officersError
            ? getRequestErrorMessage(officersError, "Please check your connection and try again.")
            : undefined
        }
        onClose={() => setOfficerPickerOpen(false)}
        onRetry={() => refetchOfficers()}
        onAssign={handleAssignOfficer}
      />

      <CloseIncidentModal
        visible={isCloseModalOpen}
        alertId={alert._id}
        onClose={() => setCloseModalOpen(false)}
      />

      <EditAlertModal
        visible={isEditModalOpen}
        alert={alert}
        onClose={() => setEditModalOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, fontSize: 14, fontWeight: "500" },
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorTitle: { fontSize: 20, fontWeight: "800", marginTop: 16 },
  errorSub: { fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 18 },
  backBtn: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  backBtnText: { fontSize: 14, fontWeight: "700" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  topRightActions: { flexDirection: "row", gap: 8 },
  circleBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  iconActionBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  topBarTitle: { fontSize: 17, fontWeight: "700" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  badgesRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  sevBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 16, lineHeight: 28 },
  closeCard: { padding: 18, marginBottom: 20, borderRadius: 20, backgroundColor: "#DCFCE7" },
  closeHeader: { flexDirection: "row", gap: 12, marginBottom: 12 },
  closeTitle: { fontSize: 16, fontWeight: "800", color: "#15803D" },
  closeSub: { fontSize: 13, color: "#166534", marginTop: 2, lineHeight: 18 },
  closeBtnAction: { backgroundColor: "#16A34A" },
  restoreCard: { padding: 16, marginBottom: 20, borderRadius: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  restoreText: { fontSize: 13, fontWeight: "600" },
  mainCard: { padding: 18, marginBottom: 20, borderRadius: 20 },
  sectionHeading: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  descriptionText: { fontSize: 14, lineHeight: 22 },
  assignmentCard: { padding: 16, marginBottom: 20 },
  assignedOfficerCard: { padding: 16, marginBottom: 20 },
  assignedOfficerLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  assignedOfficerName: { fontSize: 16, fontWeight: "800", marginTop: 2 },
  assignedOfficerEmail: { fontSize: 12, marginTop: 1 },
  reassignBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  reassignBtnText: { fontSize: 12, fontWeight: "700" },
  assignmentHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  assignmentIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  assignmentCopy: { flex: 1 },
  assignmentTitle: { fontSize: 16, fontWeight: "800" },
  assignmentDescription: { marginTop: 3, fontSize: 12, lineHeight: 17 },
  assignmentButton: { marginTop: 14, backgroundColor: "#7C3AED" },
  sectionBox: { marginBottom: 20 },
  photoScroll: { marginTop: 4 },
  evidenceImage: { width: 140, height: 100, borderRadius: 14, marginRight: 10 },
  mapCard: { padding: 0, overflow: "hidden", marginTop: 4 },
  map: { width: "100%", height: 180 },
  addressBox: { flexDirection: "row", alignItems: "center", padding: 12, gap: 8 },
  addressText: { fontSize: 13, flex: 1, fontWeight: "500" },
  officerNoteCard: { padding: 16, marginBottom: 20, borderRadius: 20 },
  officerHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  officerTitle: { fontSize: 14, fontWeight: "700" },
  officerNoteContent: { fontSize: 13, lineHeight: 20 },
  metaCard: { padding: 16 },
  metaRow: { flexDirection: "row", alignItems: "center" },
  metaLabel: { fontSize: 13, marginLeft: 8, width: 100 },
  metaValue: { fontSize: 13, fontWeight: "600" },
});


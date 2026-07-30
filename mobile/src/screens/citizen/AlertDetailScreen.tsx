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
import { COLORS, SEVERITY_COLORS } from "../../utils/constants";
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
        <View style={styles.topRightActions}>
          {canEdit ? (
            <TouchableOpacity style={styles.iconActionBtn} onPress={() => setEditModalOpen(true)}>
              <Edit2 size={18} color={COLORS.primary} />
            </TouchableOpacity>
          ) : null}
          {canDelete ? (
            <TouchableOpacity style={styles.iconActionBtn} onPress={handleDeleteAlert}>
              <Trash2 size={18} color="#DC2626" />
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
            bgColor="#F1F5F9"
            textColor="#334155"
          />
          <View style={[styles.sevBadge, { backgroundColor: sevColor.bg }]}>
            <Text style={[styles.sevBadgeText, { color: sevColor.text }]}>
              {alert.severity?.toUpperCase()} PRIORITY
            </Text>
          </View>
          <Badge label={alert.status || "PENDING"} type="status" />
          {alert.isAnonymous ? (
            <Badge label="ẨN DANH 👤" type="custom" bgColor="#F1F5F9" textColor="#475569" />
          ) : null}
          {alert.confirmationsCount && alert.confirmationsCount > 1 ? (
            <Badge label={`${alert.confirmationsCount} XÁC NHẬN 👍`} type="custom" bgColor="#DCFCE7" textColor="#166534" />
          ) : null}
          {alert.isDeleted ? (
            <Badge label="DELETED" type="custom" bgColor="#FEE2E2" textColor="#DC2626" />
          ) : null}
        </View>

        {/* Title & Description */}
        <Text style={styles.title}>{alert.title}</Text>

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
          <View style={styles.restoreCard}>
            <Text style={styles.restoreText}>This incident report is soft-deleted.</Text>
            <Button
              title="Restore Report"
              onPress={handleRestoreAlert}
              loading={restoreAlertMutation.isPending}
              variant="outline"
              icon={<RotateCcw size={16} color={COLORS.primary} style={{ marginRight: 6 }} />}
            />
          </View>
        ) : null}

        <GlassCard style={styles.mainCard}>
          <Text style={styles.sectionHeading}>Description</Text>
          <Text style={styles.descriptionText}>{alert.description}</Text>
        </GlassCard>

        {alert.assignedOfficerId ? (
          <Card style={styles.assignedOfficerCard}>
            <View style={styles.assignmentHeader}>
              <View style={[styles.assignmentIcon, { backgroundColor: "#EEF2FF" }]}>
                <UserCheck size={22} color="#4F46E5" />
              </View>
              <View style={styles.assignmentCopy}>
                <Text style={styles.assignedOfficerLabel}>Cán bộ chịu trách nhiệm</Text>
                <Text style={styles.assignedOfficerName}>
                  {officerDisplayName || "Đã phân công Cán bộ"}
                </Text>
                {assignedOfficerObj?.email ? (
                  <Text style={styles.assignedOfficerEmail}>{assignedOfficerObj.email}</Text>
                ) : null}
              </View>
              {isAdmin && normalizedStatus !== "RESOLVED" && normalizedStatus !== "CLOSED" ? (
                <TouchableOpacity
                  style={styles.reassignBtn}
                  onPress={() => setOfficerPickerOpen(true)}
                >
                  <Text style={styles.reassignBtnText}>Thay đổi</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Card>
        ) : canAssign ? (
          <Card style={styles.assignmentCard}>
            <View style={styles.assignmentHeader}>
              <View style={styles.assignmentIcon}>
                <UserCheck size={22} color="#7C3AED" />
              </View>
              <View style={styles.assignmentCopy}>
                <Text style={styles.assignmentTitle}>Assign to Officer</Text>
                <Text style={styles.assignmentDescription}>
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
  },
  topRightActions: { flexDirection: "row", gap: 8 },
  circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" },
  iconActionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" },
  topBarTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  scrollContent: { padding: 20, paddingBottom: 40 },
  badgesRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  sevBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: "800", color: COLORS.text, marginBottom: 16, lineHeight: 28 },
  closeCard: { padding: 18, marginBottom: 20, borderRadius: 20, backgroundColor: "#DCFCE7" },
  closeHeader: { flexDirection: "row", gap: 12, marginBottom: 12 },
  closeTitle: { fontSize: 16, fontWeight: "800", color: "#15803D" },
  closeSub: { fontSize: 13, color: "#166534", marginTop: 2, lineHeight: 18 },
  closeBtnAction: { backgroundColor: "#16A34A" },
  restoreCard: { padding: 16, marginBottom: 20, borderRadius: 16, backgroundColor: "#FEE2E2", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  restoreText: { fontSize: 13, fontWeight: "600", color: "#DC2626" },
  mainCard: { padding: 18, marginBottom: 20, borderRadius: 20 },
  sectionHeading: { fontSize: 15, fontWeight: "700", color: COLORS.text, marginBottom: 8 },
  descriptionText: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  assignmentCard: { padding: 16, marginBottom: 20, borderColor: "#DDD6FE", backgroundColor: "#FAF5FF" },
  assignedOfficerCard: { padding: 16, marginBottom: 20, borderColor: "#C7D2FE", backgroundColor: "#EEF2FF" },
  assignedOfficerLabel: { fontSize: 12, fontWeight: "700", color: "#4F46E5", textTransform: "uppercase", letterSpacing: 0.5 },
  assignedOfficerName: { fontSize: 16, fontWeight: "800", color: COLORS.text, marginTop: 2 },
  assignedOfficerEmail: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  reassignBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  reassignBtnText: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted },
  assignmentHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  assignmentIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#F3E8FF" },
  assignmentCopy: { flex: 1 },
  assignmentTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  assignmentDescription: { marginTop: 3, fontSize: 12, lineHeight: 17, color: COLORS.textMuted },
  assignmentButton: { marginTop: 14, backgroundColor: "#7C3AED" },
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

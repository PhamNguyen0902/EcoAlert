import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert as RNAlert,
} from "react-native";
import { X, CheckSquare, Star } from "lucide-react-native";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useCloseIncident } from "../../hooks/useAlerts";

interface CloseIncidentModalProps {
  visible: boolean;
  alertId: string;
  onClose: () => void;
}

export const CloseIncidentModal: React.FC<CloseIncidentModalProps> = ({
  visible,
  alertId,
  onClose,
}) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [reviewNote, setReviewNote] = useState("");
  const [rating, setRating] = useState(5);
  const closeMutation = useCloseIncident();

  const handleCloseIncident = async () => {
    try {
      await closeMutation.mutateAsync({
        id: alertId,
        reviewNote: reviewNote.trim() ? `[Rating: ${rating}/5] ${reviewNote.trim()}` : undefined,
      });

      RNAlert.alert(t("modals.incidentClosedTitle", "Incident Closed"), t("modals.incidentClosedMsg", "Thank you for verifying the incident resolution!"));
      setReviewNote("");
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to close incident.";
      RNAlert.alert("Error", msg);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <CheckSquare size={22} color={colors.primary} />
              <Text style={[styles.title, { color: colors.text }]}>{t("modals.closeIncidentTitle", "Confirm & Close Incident")}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subTitle, { color: colors.textMuted }]}>
            {t("modals.closeIncidentSub", "Are you satisfied with how officers resolved this report? Confirming will officially close the incident.")}
          </Text>

          <Text style={[styles.label, { color: colors.text }]}>{t("modals.rateService", "Rate Resolution Service")}</Text>
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} style={styles.starBtn}>
                <Star
                  size={28}
                  color={star <= rating ? "#EAB308" : colors.border}
                  fill={star <= rating ? "#EAB308" : "none"}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label={t("modals.citizenReviewLabel", "Optional Citizen Review / Feedback")}
            placeholder="Add comments about officer response time or resolution quality..."
            multiline
            numberOfLines={3}
            value={reviewNote}
            onChangeText={setReviewNote}
          />

          <Button
            title={t("modals.acceptCloseBtn", "Accept & Close Incident")}
            onPress={handleCloseIncident}
            loading={closeMutation.isPending}
            style={styles.submitBtn}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  closeBtn: {
    padding: 6,
  },
  subTitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 16,
  },
  starBtn: {
    padding: 4,
  },
  submitBtn: {
    marginTop: 16,
  },
});


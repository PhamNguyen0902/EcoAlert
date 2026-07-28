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
import { COLORS } from "../../utils/constants";
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
  const [reviewNote, setReviewNote] = useState("");
  const [rating, setRating] = useState(5);
  const closeMutation = useCloseIncident();

  const handleCloseIncident = async () => {
    try {
      await closeMutation.mutateAsync({
        id: alertId,
        reviewNote: reviewNote.trim() ? `[Rating: ${rating}/5] ${reviewNote.trim()}` : undefined,
      });

      RNAlert.alert("Incident Closed", "Thank you for verifying the incident resolution!");
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
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <CheckSquare size={22} color={COLORS.primary} />
              <Text style={styles.title}>Confirm & Close Incident</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subTitle}>
            Are you satisfied with how officers resolved this report? Confirming will officially close the incident.
          </Text>

          <Text style={styles.label}>Rate Resolution Service</Text>
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} style={styles.starBtn}>
                <Star
                  size={28}
                  color={star <= rating ? "#EAB308" : COLORS.textMuted}
                  fill={star <= rating ? "#EAB308" : "none"}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Optional Citizen Review / Feedback"
            placeholder="Add comments about officer response time or resolution quality..."
            multiline
            numberOfLines={3}
            value={reviewNote}
            onChangeText={setReviewNote}
          />

          <Button
            title="Accept & Close Incident"
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
    backgroundColor: COLORS.surface,
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
    color: COLORS.text,
  },
  closeBtn: {
    padding: 6,
  },
  subTitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
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
    backgroundColor: COLORS.primary,
  },
});

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, UserRound, X } from "lucide-react-native";
import { fieldColors as c } from "./stitch/fieldDesign";

interface Props {
  onBack: () => void;
  avatarLabel?: string;
  title?: string;
  onClose?: () => void;
}
export const ReportHeader = ({
  onBack,
  avatarLabel,
  title = "Báo cáo",
  onClose,
}: Props) => (
  <View style={styles.header}>
    <Pressable
      onPress={onBack}
      accessibilityRole="button"
      accessibilityLabel="Quay lại"
      style={styles.control}
    >
      <ArrowLeft size={21} color={c.secondary} />
    </Pressable>
    <View style={styles.copy}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.brand}>ECOALERT FIELD</Text>
    </View>
    {onClose ? (
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Đóng luồng báo cáo"
        style={styles.control}
      >
        <X size={18} color={c.muted} />
      </Pressable>
    ) : null}
    <View style={styles.avatar} accessibilityLabel="EcoAlert hiện trường">
      {avatarLabel ? (
        <Text style={styles.initials}>
          {avatarLabel.slice(0, 2).toUpperCase()}
        </Text>
      ) : (
        <UserRound size={16} color={c.primary} />
      )}
    </View>
  </View>
);
const styles = StyleSheet.create({
  header: {
    minHeight: 58,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  control: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 4 },
  title: {
    color: c.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
    textAlign: "center",
  },
  brand: {
    color: c.primary,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(34,197,94,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
  },
  initials: { color: c.primary, fontSize: 10, fontWeight: "800" },
});

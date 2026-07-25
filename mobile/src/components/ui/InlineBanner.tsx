import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { AlertCircle, CheckCircle2 } from "lucide-react-native";
import { COLORS } from "../../utils/constants";

type BannerType = "error" | "success";

interface InlineBannerProps {
  message: string | null;
  type?: BannerType;
}

/**
 * Inline error/success banner shown at the top of a form instead of a
 * native Alert.alert popup. Native alerts block the UI, hide the field
 * that caused the error, and feel jarring on mobile. This animates in
 * above the form so the user keeps context of what they were doing.
 */
export const InlineBanner: React.FC<InlineBannerProps> = ({ message, type = "error" }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    if (message) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(-8);
    }
  }, [message]);

  if (!message) return null;

  const isError = type === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <Animated.View
      style={[
        styles.container,
        isError ? styles.errorContainer : styles.successContainer,
        { opacity, transform: [{ translateY }] },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Icon size={18} color={isError ? COLORS.destructive : "#16A34A"} />
      <Text style={[styles.text, { color: isError ? COLORS.destructive : "#16A34A" }]}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
    gap: 10,
  },
  errorContainer: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  successContainer: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    lineHeight: 18,
  },
});

import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Clock3, MapPin, ShieldCheck } from "lucide-react-native";
import { formatCaptureTimestamp } from "../../../../utils/watermark";
import type {
  FieldReportCaptureDraft,
  FieldReportLocationDraft,
} from "../../types";
import { fieldColors as c, fieldStyles as s } from "./fieldDesign";
import {
  useForegroundScreen,
  useScreenClock,
} from "../../../../hooks/useForegroundScreen";

/** Default to reduced motion until the OS preference has been read. */
export function useFieldReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduced(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

export function FieldEntrance({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useFieldReducedMotion();
  const value = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) {
      value.setValue(1);
      return;
    }
    value.setValue(0);
    const animation = Animated.timing(value, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reduced, value]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: value,
          transform: [
            {
              translateY: value.interpolate({
                inputRange: [0, 1],
                outputRange: [6, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function FieldNotice({
  children,
  title,
  tone = "cyan",
}: {
  children: React.ReactNode;
  title?: string;
  tone?: "cyan" | "amber" | "green";
}) {
  const color =
    tone === "amber" ? c.amber : tone === "green" ? c.primary : c.cyan;
  return (
    <View style={[styles.notice, { borderColor: `${color}25` }]}>
      <View style={[styles.noticeIcon, { backgroundColor: `${color}15` }]}>
        <ShieldCheck size={16} color={color} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        {title ? <Text style={[s.eyebrow, { color }]}>{title}</Text> : null}
        <Text style={s.meta}>{children}</Text>
      </View>
    </View>
  );
}

export function FieldEvidenceMetaOverlay({
  location,
  capture,
  live = false,
  timestamp,
}: {
  location?: FieldReportLocationDraft;
  capture?: FieldReportCaptureDraft;
  live?: boolean;
  timestamp?: string;
}) {
  const time = timestamp || capture?.capturedAt;
  return (
    <LinearGradient
      pointerEvents="none"
      colors={["transparent", "rgba(7,16,31,0.95)"]}
      style={styles.evidence}
    >
      <View style={s.row}>
        <ShieldCheck size={12} color={c.primary} />
        <Text style={[s.eyebrow, { color: c.primary }]}>
          {live ? "ECOALERT FIELD CAPTURE" : "MINH CHỨNG HIỆN TRƯỜNG"}
        </Text>
      </View>
      {location ? (
        <View style={s.row}>
          <MapPin size={11} color={c.cyan} />
          <Text style={styles.evidenceText}>
            {location.latitude.toFixed(6)}°, {location.longitude.toFixed(6)}° ·
            ±{Math.round(location.accuracyMeters)}m
          </Text>
        </View>
      ) : null}
      {time && Number.isFinite(Date.parse(time)) ? (
        <View style={s.row}>
          <Clock3 size={11} color={c.cyan} />
          <Text style={styles.evidenceText}>
            {formatCaptureTimestamp(new Date(time))}
          </Text>
        </View>
      ) : null}
    </LinearGradient>
  );
}

/** Keep the live clock local so each tick does not rerender the native camera. */
export function FieldLiveEvidenceMetaOverlay({
  location,
  active,
}: {
  location?: FieldReportLocationDraft;
  active: boolean;
}) {
  const now = useScreenClock(1000, active);
  return (
    <FieldEvidenceMetaOverlay
      location={location}
      live
      timestamp={new Date(now).toISOString()}
    />
  );
}

/** Processing indicator only, never a fabricated progress percentage. */
export function FieldScanLine() {
  const reduced = useFieldReducedMotion();
  const active = useForegroundScreen();
  const [height, setHeight] = useState(0);
  const position = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    position.setValue(0);
    if (reduced || !active || !height) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(position, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(position, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [position, reduced, active, height]);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
      onLayout={({ nativeEvent }) => setHeight(nativeEvent.layout.height)}
    >
      <Animated.View
        style={[
          styles.scanLine,
          {
            top: 0,
            transform: [
              {
                translateY: position.interpolate({
                  inputRange: [0, 1],
                  outputRange: [height * 0.12, height * 0.85],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  noticeIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  evidence: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    paddingTop: 32,
    gap: 4,
  },
  evidenceText: {
    color: c.secondary,
    fontSize: 10,
    lineHeight: 15,
    flex: 1,
    fontVariant: ["tabular-nums"],
  },
  scanLine: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: c.cyan,
    shadowColor: c.cyan,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});

import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Expand } from "lucide-react-native";
import {
  EVIDENCE_FRAME_ASPECT_RATIO,
  EVIDENCE_FRAME_MAX_WIDTH,
  EVIDENCE_FRAME_WIDTH,
} from "../../utils/evidenceImageFrame";
import { ZoomableImageViewer } from "./ZoomableImageViewer";

export interface EvidenceImageFrameProps {
  imageUri: string;
  fallbackUri?: string;
  onPress?: (renderedUri: string) => void;
  overlay?: React.ReactNode;
  showExpandIcon?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** Compact thumbnails may override sizing, but always keep contain rendering. */
  style?: StyleProp<ViewStyle>;
}

/** A new URI starts a new loading/viewer session, including after a retake. */
export function EvidenceImageFrame(props: EvidenceImageFrameProps) {
  return <EvidenceFrameSession key={props.imageUri} {...props} />;
}

function EvidenceFrameSession({
  imageUri,
  fallbackUri,
  onPress,
  overlay,
  showExpandIcon = true,
  disabled = false,
  accessibilityLabel = "Ảnh hiện trường",
  style,
}: EvidenceImageFrameProps) {
  const [uri, setUri] = useState(imageUri);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.frame,
          style,
          pressed && styles.pressed,
        ]}
        disabled={disabled || !loaded || failed}
        onPress={(event) => {
          // A thumbnail can live in a report card: viewing it must not navigate.
          event.stopPropagation();
          if (onPress) onPress(uri);
          else setViewerOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Chạm để xem ảnh lớn, phóng to hoặc thu nhỏ"
        accessibilityState={{ disabled: disabled || !loaded || failed }}
      >
        <Image
          key={uri}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          accessible={false}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            if (fallbackUri && uri !== fallbackUri) setUri(fallbackUri);
            else setFailed(true);
          }}
        />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {overlay}
        </View>
        {!loaded && !failed ? (
          <ActivityIndicator
            style={StyleSheet.absoluteFill}
            color="#22C55E"
            accessibilityLabel="Đang tải ảnh"
          />
        ) : null}
        {failed ? (
          <Text style={styles.error} accessibilityRole="alert">
            Không thể tải ảnh hiện trường.
          </Text>
        ) : null}
        {showExpandIcon && !disabled && loaded && !failed ? (
          <View style={styles.expand} pointerEvents="none">
            <Expand size={17} color="#F8FAFC" />
          </View>
        ) : null}
      </Pressable>
      <ZoomableImageViewer
        visible={viewerOpen}
        imageUri={uri}
        onClose={() => setViewerOpen(false)}
        altLabel={accessibilityLabel}
      />
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: EVIDENCE_FRAME_WIDTH,
    maxWidth: EVIDENCE_FRAME_MAX_WIDTH,
    aspectRatio: EVIDENCE_FRAME_ASPECT_RATIO,
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "#050D17",
    justifyContent: "center",
  },
  pressed: { opacity: 0.94 },
  expand: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7,16,31,0.70)",
  },
  error: {
    color: "#94A3B8",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    margin: 16,
  },
});

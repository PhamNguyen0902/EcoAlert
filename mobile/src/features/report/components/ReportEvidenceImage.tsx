import React, { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Maximize2 } from "lucide-react-native";
import type { ImageSize } from "../../../utils/visionBoundingBox";
import { calculateReportImageHeight } from "../../../utils/visionBoundingBox";

/** Confirmation shows the watermarked rendition without detections or cropping. */
export const ReportEvidenceImage = (props: {
  imageUri: string;
  fallbackUri: string;
  onPress?: (renderedUri: string) => void;
}) => <EvidenceImageSession key={props.imageUri} {...props} />;

function EvidenceImageSession({
  imageUri,
  fallbackUri,
  onPress,
}: {
  imageUri: string;
  fallbackUri: string;
  onPress?: (renderedUri: string) => void;
}) {
  const [uri, setUri] = useState(imageUri);
  const [size, setSize] = useState<ImageSize | null>(null);
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    setSize(null);
    setLoaded(false);
    Image.getSize(
      uri,
      (imageWidth, imageHeight) => {
        if (active) setSize({ width: imageWidth, height: imageHeight });
      },
      () => {
        /* onLoad also provides the rendered image dimensions. */
      },
    );
    return () => {
      active = false;
    };
  }, [uri]);
  return (
    <Pressable
      onPress={() => onPress?.(uri)}
      disabled={!onPress || !loaded || failed}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel="Xem ảnh hiện trường toàn màn hình"
      accessibilityHint="Chạm để phóng to ảnh"
      style={[
        styles.frame,
        { height: calculateReportImageHeight(size, width, "confirmation") },
      ]}
      onLayout={({ nativeEvent: { layout } }) => setWidth(layout.width)}
    >
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="contain"
        accessibilityLabel="Ảnh hiện trường gửi kèm báo cáo"
        onLoad={({ nativeEvent: { source } }) => {
          setLoaded(true);
          if (source?.width && source.height)
            setSize(
              (current) =>
                current ?? { width: source.width, height: source.height },
            );
        }}
        onError={() => {
          setLoaded(false);
          if (uri !== fallbackUri) setUri(fallbackUri);
          else setFailed(true);
        }}
      />
      {failed ? (
        <Text style={styles.error}>Không thể tải ảnh hiện trường.</Text>
      ) : null}
      {onPress && loaded && !failed ? (
        <View style={styles.expand} pointerEvents="none">
          <Maximize2 size={17} color="#F8FAFC" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#050D17",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.10)",
  },
  expand: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7,16,31,0.72)",
  },
  error: {
    color: "#94A3B8",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    margin: 24,
  },
});

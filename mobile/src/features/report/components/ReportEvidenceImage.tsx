import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { ImageSize } from "../../../utils/visionBoundingBox";
import { calculateReportImageHeight } from "../../../utils/visionBoundingBox";

/** Confirmation shows the watermarked rendition without detections or cropping. */
export const ReportEvidenceImage = (props: {
  imageUri: string;
  fallbackUri: string;
}) => <EvidenceImageSession key={props.imageUri} {...props} />;

function EvidenceImageSession({
  imageUri,
  fallbackUri,
}: {
  imageUri: string;
  fallbackUri: string;
}) {
  const [uri, setUri] = useState(imageUri);
  const [size, setSize] = useState<ImageSize | null>(null);
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setSize(null);
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
    <View
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
          if (source?.width && source.height)
            setSize(
              (current) =>
                current ?? { width: source.width, height: source.height },
            );
        }}
        onError={() => {
          if (uri !== fallbackUri) setUri(fallbackUri);
          else setFailed(true);
        }}
      />
      {failed ? (
        <Text style={styles.error}>Không thể tải ảnh hiện trường.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#050D17",
    overflow: "hidden",
  },
  error: {
    color: "#94A3B8",
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    margin: 24,
  },
});

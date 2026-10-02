import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ImageLoadEvent } from "react-native";
import type { VisionEvidence } from "../../types";
import {
  calculateContainedImageRect,
  formatDetectionConfidence,
  getWasteDetectionLabel,
  positionDetectionLabel,
  transformBoundingBox,
} from "../../utils/visionBoundingBox";
import type {
  ContainedImageRect,
  ImageSize,
  ScreenBoundingBox,
} from "../../utils/visionBoundingBox";

export interface WasteDetectionImageProps {
  imageUri: string;
  detections: VisionEvidence["detections"];
  height?: number;
  showLabels?: boolean;
  resizeMode?: "contain";
  emptyMessage?: string;
}

/** A keyed image session prevents old size/load callbacks from affecting a new URI. */
export const WasteDetectionImage = (props: WasteDetectionImageProps) => (
  <DetectionImageSession key={props.imageUri} {...props} />
);

function DetectionImageSession({
  imageUri,
  detections,
  height = 240,
  showLabels = true,
  resizeMode = "contain",
  emptyMessage,
}: WasteDetectionImageProps) {
  const [original, setOriginal] = useState<ImageSize | null>(null);
  const [container, setContainer] = useState<ImageSize>({
    width: 0,
    height: 0,
  });
  const [loaded, setLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const active = useRef(true);
  const handleImageLoad = useCallback(({ nativeEvent }: ImageLoadEvent) => {
    if (!active.current) return;
    // Prefer getSize's original dimensions. onLoad is only a fallback, not a rendition-size override.
    const size = nativeEvent.source;
    if (size && calculateContainedImageRect(size, { width: 1, height: 1 }))
      setOriginal(
        (current) => current ?? { width: size.width, height: size.height },
      );
    setLoaded(true);
    setImageError(false);
  }, []);
  const handleImageError = useCallback(() => {
    if (active.current) {
      setImageError(true);
      setLoaded(false);
    }
  }, []);

  useEffect(() => {
    active.current = true;
    Image.getSize(
      imageUri,
      (width, imageHeight) => {
        if (
          active.current &&
          calculateContainedImageRect(
            { width, height: imageHeight },
            { width: 1, height: 1 },
          )
        )
          setOriginal({ width, height: imageHeight });
      },
      () => {
        /* onLoad can still provide dimensions when a size lookup fails. */
      },
    );
    return () => {
      active.current = false;
    };
  }, [imageUri]);

  const rect = useMemo(
    () => (original ? calculateContainedImageRect(original, container) : null),
    [original, container],
  );
  const boxes = useMemo(() => {
    if (!original || !rect || !loaded || imageError) return [];
    return detections.flatMap((detection, index) => {
      const box = transformBoundingBox(detection.bbox, original, rect);
      return box
        ? [
            {
              box,
              detection,
              key: `${detection.materialClass}-${index}-${detection.bbox?.join("-")}`,
            },
          ]
        : [];
    });
  }, [original, rect, loaded, imageError, detections]);

  useEffect(() => {
    opacity.setValue(0);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    });
    if (boxes.length) animation.start();
    return () => animation.stop();
  }, [boxes.length, opacity]);

  return (
    <View>
      <View
        style={[styles.frame, { height }]}
        onLayout={({ nativeEvent: { layout } }) => {
          setContainer((current) =>
            current.width === layout.width && current.height === layout.height
              ? current
              : { width: layout.width, height: layout.height },
          );
        }}
      >
        <Image
          source={{ uri: imageUri }}
          resizeMode={resizeMode}
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Ảnh gốc dùng để nhận diện rác thải"
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
        {!loaded && !imageError ? (
          <ActivityIndicator
            style={styles.loading}
            color="#22C55E"
            accessibilityLabel="Đang tải ảnh gốc"
          />
        ) : null}
        {imageError ? (
          <Text style={styles.error} accessibilityRole="alert">
            Không thể tải ảnh để hiển thị kết quả nhận diện.
          </Text>
        ) : null}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity }]}
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {rect &&
            boxes.map(({ box, detection, key }) => (
              <React.Fragment key={key}>
                <View style={[styles.box, box]} />
                {showLabels && rect.height >= 24 ? (
                  <DetectionLabel
                    box={box}
                    rect={rect}
                    text={[
                      getWasteDetectionLabel(detection.materialClass),
                      formatDetectionConfidence(detection.confidence),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                ) : null}
              </React.Fragment>
            ))}
        </Animated.View>
      </View>
      {loaded && !imageError && !original ? (
        <Text style={styles.message}>
          Chưa xác định được kích thước ảnh để vẽ vùng nhận diện.
        </Text>
      ) : null}
      {!detections.length && emptyMessage ? (
        <Text style={styles.message}>{emptyMessage}</Text>
      ) : null}
    </View>
  );
}

function DetectionLabel({
  box,
  rect,
  text,
}: {
  box: ScreenBoundingBox;
  rect: ContainedImageRect;
  text: string;
}) {
  const [size, setSize] = useState<ImageSize>({ width: 140, height: 22 });
  const position = positionDetectionLabel(box, size, rect);
  return (
    <View
      style={[
        styles.label,
        { left: position.left, top: position.top, maxWidth: rect.width },
      ]}
      onLayout={({ nativeEvent: { layout } }) =>
        setSize((current) =>
          current.width === layout.width && current.height === layout.height
            ? current
            : { width: layout.width, height: layout.height },
        )
      }
    >
      <Text style={styles.labelText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#07101F",
  },
  box: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#22C55E",
    backgroundColor: "rgba(34,197,94,0.05)",
    borderRadius: 4,
  },
  label: {
    position: "absolute",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.45)",
    backgroundColor: "rgba(7,16,31,0.88)",
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  labelText: {
    color: "#F8FAFC",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
  },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    justifyContent: "center",
  },
  error: {
    color: "#F8FAFC",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    margin: 24,
  },
  message: { color: "#94A3B8", fontSize: 12, lineHeight: 18, marginTop: 8 },
});

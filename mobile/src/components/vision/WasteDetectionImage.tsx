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
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ImageLoadEvent } from "react-native";
import type { VisionEvidence } from "../../types";
import {
  calculateContainedImageRect,
  calculateReportImageHeight,
  formatDetectionConfidence,
  getDetectionConfidenceColor,
  getShortWasteDetectionLabel,
  getWasteDetectionLabel,
  positionDetectionLabel,
  shouldNumberDetectionLabels,
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
  height,
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
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
  const numbered = shouldNumberDetectionLabels(boxes.map(({ box }) => box));
  const selected = boxes.find(({ key }) => key === selectedKey);
  const frameHeight =
    height ?? calculateReportImageHeight(original, container.width);

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
        style={[styles.frame, { height: frameHeight }]}
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
          pointerEvents="box-none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {rect &&
            boxes.map(({ box, detection, key }, index) => (
              <React.Fragment key={key}>
                <Pressable
                  onPress={() =>
                    setSelectedKey((current) => (current === key ? null : key))
                  }
                  style={[
                    styles.box,
                    box,
                    key === selectedKey && styles.selectedBox,
                  ]}
                  accessible={false}
                />
                {showLabels &&
                rect.height >= 24 &&
                !(
                  key === selectedKey &&
                  !numbered &&
                  box.width >= 80 &&
                  box.height >= 36
                ) ? (
                  <DetectionLabel
                    box={box}
                    rect={rect}
                    numbered={numbered || box.width < 80 || box.height < 36}
                    color={getDetectionConfidenceColor(detection.confidence)}
                    onPress={() =>
                      setSelectedKey((current) =>
                        current === key ? null : key,
                      )
                    }
                    text={
                      numbered || box.width < 80 || box.height < 36
                        ? String(index + 1)
                        : [
                            getShortWasteDetectionLabel(
                              detection.materialClass,
                            ),
                            formatDetectionConfidence(detection.confidence),
                          ]
                            .filter(Boolean)
                            .join(" · ")
                    }
                  />
                ) : null}
              </React.Fragment>
            ))}
          {showLabels && selected && rect ? (
            <DetectionLabel
              box={selected.box}
              rect={rect}
              color={getDetectionConfidenceColor(selected.detection.confidence)}
              text={[
                getWasteDetectionLabel(selected.detection.materialClass),
                formatDetectionConfidence(selected.detection.confidence),
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          ) : null}
        </Animated.View>
      </View>
      {showLabels && boxes.length ? (
        <Text style={styles.message}>
          {boxes.length} vùng được đánh dấu · Chạm một vùng để xem chi tiết.
        </Text>
      ) : null}
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
  numbered = false,
  color,
  onPress,
}: {
  box: ScreenBoundingBox;
  rect: ContainedImageRect;
  text: string;
  numbered?: boolean;
  color: string;
  onPress?: () => void;
}) {
  const [size, setSize] = useState<ImageSize>({
    width: numbered ? 18 : 90,
    height: numbered ? 18 : 22,
  });
  const position = positionDetectionLabel(box, size, rect);
  return (
    <Pressable
      onPress={onPress}
      pointerEvents={onPress ? "auto" : "none"}
      accessible={false}
      style={[
        styles.label,
        numbered && styles.numberBadge,
        {
          left: position.left,
          top: position.top,
          maxWidth: rect.width,
          borderColor: color,
        },
      ]}
      onLayout={({ nativeEvent: { layout } }) =>
        setSize((current) =>
          current.width === layout.width && current.height === layout.height
            ? current
            : { width: layout.width, height: layout.height },
        )
      }
    >
      <Text style={[styles.labelText, { color }]} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "#050D17",
  },
  box: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "#22C55E",
    backgroundColor: "rgba(34,197,94,0.025)",
    borderRadius: 3,
  },
  selectedBox: { borderWidth: 3, backgroundColor: "rgba(34,197,94,0.1)" },
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
  numberBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    paddingVertical: 0,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
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

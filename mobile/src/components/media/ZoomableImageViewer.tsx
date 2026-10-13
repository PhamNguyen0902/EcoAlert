import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Minus, Plus, X } from "lucide-react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { calculateContainedImageRect } from "../../utils/visionBoundingBox";
import type { ImageSize } from "../../utils/visionBoundingBox";
import {
  calculateImagePanBounds,
  clampImagePan,
  clampImageZoom,
  getDoubleTapImageZoom,
} from "../../utils/imageViewer";

export interface ZoomableImageViewerProps {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
  altLabel?: string;
}

/** Closed sessions unmount, so reopening/changing URI always starts centered at 1x. */
export function ZoomableImageViewer({
  visible,
  ...props
}: ZoomableImageViewerProps) {
  return visible ? (
    <ImageViewerSession key={props.imageUri} {...props} />
  ) : null;
}

function ImageViewerSession({
  imageUri,
  onClose,
  altLabel = "Ảnh hiện trường",
}: Omit<ZoomableImageViewerProps, "visible">) {
  const insets = useSafeAreaInsets();
  const [original, setOriginal] = useState<ImageSize | null>(null);
  const [viewport, setViewport] = useState<ImageSize>({ width: 0, height: 0 });
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoomLabel, setZoomLabel] = useState(1);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const pinchStartX = useSharedValue(0);
  const pinchStartY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);

  useEffect(() => {
    let active = true;
    Image.getSize(
      imageUri,
      (width, height) => {
        if (active && width > 0 && height > 0) setOriginal({ width, height });
      },
      () => {
        /* onLoad is a fallback; onError renders a friendly message. */
      },
    );
    return () => {
      active = false;
    };
  }, [imageUri]);

  const rect = original
    ? calculateContainedImageRect(original, viewport)
    : null;
  const fittedWidth = rect?.width ?? 0;
  const fittedHeight = rect?.height ?? 0;
  const hasDimensions = Boolean(rect);

  const reset = useCallback(() => {
    cancelAnimation(scale);
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    setZoomLabel(1);
  }, [scale, translateX, translateY]);

  // Layout changes invalidate translation bounds; never retain an off-screen image after rotation.
  useEffect(() => {
    reset();
  }, [fittedWidth, fittedHeight, viewport.width, viewport.height, reset]);

  const animateZoom = useCallback(
    (value: number) => {
      "worklet";
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      const next = clampImageZoom(value);
      const bounds = calculateImagePanBounds(
        { width: fittedWidth, height: fittedHeight },
        viewport,
        next,
      );
      scale.value = withTiming(next, { duration: 200 });
      translateX.value = withTiming(clampImagePan(translateX.value, bounds.x), {
        duration: 200,
      });
      translateY.value = withTiming(clampImagePan(translateY.value, bounds.y), {
        duration: 200,
      });
    },
    [fittedWidth, fittedHeight, viewport, scale, translateX, translateY],
  );

  useAnimatedReaction(
    () => Math.round(scale.value * 10) / 10,
    (value, previous) => {
      if (value !== previous) runOnJS(setZoomLabel)(value);
    },
  );

  const gestures = useMemo(() => {
    const pinch = Gesture.Pinch()
      .enabled(loaded && !failed && hasDimensions)
      .onStart(() => {
        cancelAnimation(scale);
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        pinchStartScale.value = scale.value;
        pinchStartX.value = translateX.value;
        pinchStartY.value = translateY.value;
      })
      .onUpdate((event) => {
        const next = clampImageZoom(pinchStartScale.value * event.scale);
        const bounds = calculateImagePanBounds(
          { width: fittedWidth, height: fittedHeight },
          viewport,
          next,
        );
        scale.value = next;
        translateX.value = clampImagePan(pinchStartX.value, bounds.x);
        translateY.value = clampImagePan(pinchStartY.value, bounds.y);
      });
    const pan = Gesture.Pan()
      .maxPointers(1)
      .minDistance(4)
      .enabled(loaded && !failed && hasDimensions)
      .onStart(() => {
        cancelAnimation(scale);
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        panStartX.value = translateX.value;
        panStartY.value = translateY.value;
      })
      .onUpdate((event) => {
        const bounds = calculateImagePanBounds(
          { width: fittedWidth, height: fittedHeight },
          viewport,
          scale.value,
        );
        translateX.value = clampImagePan(
          panStartX.value + event.translationX,
          bounds.x,
        );
        translateY.value = clampImagePan(
          panStartY.value + event.translationY,
          bounds.y,
        );
      });
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(350)
      .enabled(loaded && !failed && hasDimensions)
      .onEnd((_event, success) => {
        if (success) animateZoom(getDoubleTapImageZoom(scale.value));
      });
    return Gesture.Simultaneous(pinch, pan, doubleTap);
  }, [
    loaded,
    failed,
    fittedWidth,
    fittedHeight,
    viewport,
    hasDimensions,
    scale,
    translateX,
    translateY,
    pinchStartScale,
    pinchStartX,
    pinchStartY,
    panStartX,
    panStartY,
    animateZoom,
  ]);

  const imageStyle = useAnimatedStyle(() => {
    const bounds = calculateImagePanBounds(
      { width: fittedWidth, height: fittedHeight },
      viewport,
      scale.value,
    );
    return {
      transform: [
        { translateX: clampImagePan(translateX.value, bounds.x) },
        { translateY: clampImagePan(translateY.value, bounds.y) },
        { scale: scale.value },
      ],
    };
  });
  const close = () => {
    reset();
    onClose();
  };
  const canZoom = loaded && !failed && Boolean(rect);

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={close}
    >
      <GestureHandlerRootView style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.title} numberOfLines={1}>
            {altLabel}
          </Text>
          <Pressable
            onPress={close}
            style={styles.control}
            accessibilityRole="button"
            accessibilityLabel="Đóng trình xem ảnh"
          >
            <X size={23} color="#F8FAFC" />
          </Pressable>
        </View>
        <GestureDetector gesture={gestures}>
          <View
            collapsable={false}
            style={styles.viewport}
            onLayout={({ nativeEvent: { layout } }) =>
              setViewport((current) =>
                current.width === layout.width &&
                current.height === layout.height
                  ? current
                  : { width: layout.width, height: layout.height },
              )
            }
          >
            <Animated.View
              style={[
                {
                  width: fittedWidth || "100%",
                  height: fittedHeight || "100%",
                },
                imageStyle,
              ]}
            >
              <Image
                source={{ uri: imageUri }}
                resizeMode="contain"
                style={StyleSheet.absoluteFill}
                accessibilityLabel={altLabel}
                onLoad={({ nativeEvent: { source } }) => {
                  if (source?.width && source.height)
                    setOriginal(
                      (current) =>
                        current ?? {
                          width: source.width,
                          height: source.height,
                        },
                    );
                  setLoaded(true);
                  setFailed(false);
                }}
                onError={() => {
                  setFailed(true);
                  setLoaded(false);
                }}
              />
            </Animated.View>
            {!loaded && !failed ? (
              <ActivityIndicator
                style={styles.feedback}
                color="#22C55E"
                accessibilityLabel="Đang tải ảnh"
              />
            ) : null}
            {failed ? (
              <View style={styles.feedback}>
                <Text style={styles.error} accessibilityRole="alert">
                  Không thể tải ảnh.
                </Text>
              </View>
            ) : null}
          </View>
        </GestureDetector>
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(16, insets.bottom) },
          ]}
        >
          <View style={styles.toolbar}>
            <Pressable
              onPress={() => animateZoom(scale.value - 0.5)}
              disabled={!canZoom || zoomLabel <= 1}
              style={[
                styles.control,
                (!canZoom || zoomLabel <= 1) && styles.disabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Thu nhỏ ảnh"
            >
              <Minus size={20} color="#F8FAFC" />
            </Pressable>
            <Text
              style={styles.zoomText}
              accessibilityLabel={`Mức phóng to ${zoomLabel} lần`}
            >
              {zoomLabel.toFixed(1)}×
            </Text>
            <Pressable
              onPress={() => animateZoom(scale.value + 0.5)}
              disabled={!canZoom || zoomLabel >= 4}
              style={[
                styles.control,
                (!canZoom || zoomLabel >= 4) && styles.disabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Phóng to ảnh"
            >
              <Plus size={20} color="#F8FAFC" />
            </Pressable>
            <Pressable
              onPress={reset}
              disabled={!canZoom}
              style={[styles.control, !canZoom && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel="Đặt lại mức phóng to"
            >
              <Text style={styles.resetText}>1:1</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            {zoomLabel <= 1.1
              ? "Chụm hai ngón hoặc nhấn đúp để phóng to"
              : "Kéo để xem chi tiết · Chụm hai ngón để thu nhỏ"}
          </Text>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#02070D" },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: { flex: 1, color: "#F8FAFC", fontSize: 15, fontWeight: "600" },
  control: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148,163,184,0.08)",
  },
  viewport: {
    flex: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  feedback: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 10,
    alignItems: "center",
  },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 10 },
  zoomText: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: "600",
    width: 46,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  resetText: { color: "#94A3B8", fontSize: 12, fontWeight: "700" },
  hint: { color: "#94A3B8", fontSize: 11, lineHeight: 17, textAlign: "center" },
  error: { color: "#CBD5E1", fontSize: 13, textAlign: "center", padding: 24 },
  disabled: { opacity: 0.4 },
});

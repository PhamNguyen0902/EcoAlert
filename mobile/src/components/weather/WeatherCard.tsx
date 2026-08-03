import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AlertCircle, ChevronRight, CloudSun, Droplets, MapPin, RefreshCw, Wind } from "lucide-react-native";
import type { CurrentWeather } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";

interface WeatherCardProps {
  weather?: CurrentWeather;
  locationLabel: string;
  isLoading: boolean;
  isError: boolean;
  isCached?: boolean;
  onRetry: () => void;
  onPress: () => void;
}

export const WeatherCard: React.FC<WeatherCardProps> = ({
  weather,
  locationLabel,
  isLoading,
  isError,
  isCached = false,
  onRetry,
  onPress,
}) => {
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const copy = language === "vi"
    ? {
        title: "Thời tiết hiện tại",
        loading: "Đang tải thời tiết",
        unavailable: "Chưa thể tải thời tiết",
        unavailableBody: "Dữ liệu đã lưu sẽ được giữ lại khi có thể.",
        retry: "Thử lại",
        feels: "Cảm giác như",
        humidity: "Độ ẩm",
        wind: "Gió",
        air: "Không khí",
        cached: "Đã lưu",
        details: "Xem chi tiết thời tiết",
      }
    : {
        title: "Current weather",
        loading: "Loading weather",
        unavailable: "Weather unavailable",
        unavailableBody: "Previously cached data is kept when available.",
        retry: "Retry",
        feels: "Feels like",
        humidity: "Humidity",
        wind: "Wind",
        air: "Air",
        cached: "Cached",
        details: "View weather details",
      };

  const cardColors = {
    background: isDark ? "#122238" : "#EFF8FF",
    border: isDark ? "#29445F" : "#CFE7F7",
    accent: isDark ? "#67E8F9" : "#0369A1",
    metric: isDark ? "#1B3048" : "rgba(255,255,255,0.82)",
  };

  if (isLoading && !weather) {
    return (
      <View
        style={[styles.card, { backgroundColor: cardColors.background, borderColor: cardColors.border }]}
        accessible
        accessibilityLabel={copy.loading}
        accessibilityState={{ busy: true }}
      >
        <View style={styles.skeletonHeader}>
          <View style={[styles.skeletonTitle, { backgroundColor: colors.border }]} />
          <ActivityIndicator color={colors.secondary} size="small" />
        </View>
        <View style={[styles.skeletonTemperature, { backgroundColor: colors.border }]} />
        <View style={styles.skeletonMetrics}>
          {[0, 1, 2].map((item) => (
            <View key={item} style={[styles.skeletonMetric, { backgroundColor: colors.border }]} />
          ))}
        </View>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>{copy.loading}…</Text>
      </View>
    );
  }

  if ((isError && !weather) || !weather) {
    return (
      <View style={[styles.card, styles.centered, { backgroundColor: cardColors.background, borderColor: cardColors.border }]}>
        <AlertCircle size={26} color={colors.destructive} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>{copy.unavailable}</Text>
        <Text style={[styles.errorBody, { color: colors.textMuted }]}>{copy.unavailableBody}</Text>
        <TouchableOpacity
          onPress={onRetry}
          activeOpacity={0.75}
          style={[styles.retryButton, { borderColor: cardColors.border }]}
          accessibilityRole="button"
          accessibilityLabel={copy.retry}
        >
          <RefreshCw size={15} color={cardColors.accent} />
          <Text style={[styles.retryText, { color: cardColors.accent }]}>{copy.retry}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const roundedTemperature = Math.round(weather.temperature);
  const updatedTime = new Date(weather.lastUpdated).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: cardColors.background, borderColor: cardColors.border },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${copy.title}. ${roundedTemperature} degrees, ${weather.description}. ${copy.humidity} ${weather.humidity} percent.`}
      accessibilityHint={copy.details}
    >
      <View style={styles.topRow}>
        <View style={styles.titleRow}>
          <CloudSun size={18} color={cardColors.accent} />
          <Text style={[styles.eyebrow, { color: cardColors.accent }]}>{copy.title}</Text>
        </View>
        <Text style={[styles.updated, { color: colors.textMuted }]}>
          {isCached ? `${copy.cached} · ` : ""}{updatedTime}
        </Text>
      </View>

      <View style={styles.weatherRow}>
        <View style={styles.temperatureBlock}>
          <Text style={[styles.temperature, { color: colors.text }]}>{roundedTemperature}°</Text>
          <View style={styles.conditionBlock}>
            <Text style={[styles.condition, { color: colors.text }]} numberOfLines={1}>
              {weather.description}
            </Text>
            <Text style={[styles.feelsLike, { color: colors.textMuted }]}>
              {copy.feels} {Math.round(weather.feelsLike)}°
            </Text>
          </View>
        </View>
        {weather.icon ? (
          <Image
            source={{ uri: weather.icon }}
            style={styles.weatherIcon}
            accessibilityIgnoresInvertColors
            accessibilityLabel={weather.description}
          />
        ) : null}
      </View>

      <View style={styles.metricsRow}>
        <View style={[styles.metric, { backgroundColor: cardColors.metric }]}>
          <Droplets size={16} color="#38BDF8" />
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{copy.humidity}</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>{weather.humidity}%</Text>
        </View>
        <View style={[styles.metric, { backgroundColor: cardColors.metric }]}>
          <Wind size={16} color="#2DD4BF" />
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{copy.wind}</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>{weather.windSpeed} km/h</Text>
        </View>
        <View style={[styles.metric, { backgroundColor: cardColors.metric }]}>
          <View style={[styles.aqiDot, { backgroundColor: weather.aqi <= 2 ? "#22C55E" : weather.aqi === 3 ? "#F59E0B" : "#EF4444" }]} />
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{copy.air}</Text>
          <Text style={[styles.metricValue, { color: colors.text }]} numberOfLines={1}>{weather.aqiLabel}</Text>
        </View>
      </View>

      <View style={styles.locationRow}>
        <MapPin size={14} color={colors.textMuted} />
        <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
          {locationLabel}
        </Text>
        <ChevronRight size={16} color={cardColors.accent} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: { minHeight: 218, borderWidth: 1, borderRadius: 20, padding: 16 },
  centered: { alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { fontSize: 13, fontWeight: "600" },
  skeletonHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  skeletonTitle: { width: 132, height: 16, borderRadius: 8, opacity: 0.6 },
  skeletonTemperature: { width: 145, height: 48, borderRadius: 14, opacity: 0.55, marginTop: 22 },
  skeletonMetrics: { flexDirection: "row", gap: 8, marginTop: 22 },
  skeletonMetric: { flex: 1, height: 58, borderRadius: 12, opacity: 0.45 },
  errorTitle: { fontSize: 15, fontWeight: "800", marginTop: 2 },
  errorBody: { fontSize: 12, lineHeight: 17, textAlign: "center", maxWidth: 250 },
  retryButton: { minHeight: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 7, marginTop: 4 },
  retryText: { fontSize: 13, fontWeight: "800" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  eyebrow: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  updated: { fontSize: 11, fontWeight: "600" },
  weatherRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 82 },
  temperatureBlock: { flexDirection: "row", alignItems: "center", flex: 1 },
  temperature: { fontSize: 47, lineHeight: 56, fontWeight: "800", letterSpacing: -2 },
  conditionBlock: { flex: 1, marginLeft: 12 },
  condition: { fontSize: 15, fontWeight: "800", textTransform: "capitalize" },
  feelsLike: { fontSize: 12, marginTop: 3 },
  weatherIcon: { width: 70, height: 70 },
  metricsRow: { flexDirection: "row", gap: 8 },
  metric: { flex: 1, minHeight: 58, borderRadius: 12, padding: 8, justifyContent: "center" },
  metricLabel: { fontSize: 10, marginTop: 3 },
  metricValue: { fontSize: 12, fontWeight: "800", marginTop: 1 },
  aqiDot: { width: 8, height: 8, borderRadius: 4, marginVertical: 4 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  locationText: { flex: 1, fontSize: 11, fontWeight: "600" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});

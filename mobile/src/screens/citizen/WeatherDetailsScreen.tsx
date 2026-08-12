import React, { useMemo } from "react";
import {
  Image,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  AlertTriangle,
  ArrowLeft,
  Cloud,
  CloudSun,
  Droplets,
  Eye,
  Gauge,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sunrise,
  Sunset,
  Thermometer,
  Umbrella,
  Wind,
} from "lucide-react-native";
import type { CitizenStackParamList } from "../../navigation/types";
import type { WeatherGuidanceCode } from "../../utils/weather";
import { useWeatherDetails } from "../../hooks/useWeather";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  formatWeatherDay,
  formatWeatherDate,
  formatWeatherTime,
  getProviderLocalDate,
  getWeatherAlert,
  getWeatherGuidance,
} from "../../utils/weather";
import { getWeatherConditionDisplay } from "../../utils/domainI18n";

type Props = NativeStackScreenProps<CitizenStackParamList, "WeatherDetails">;

const EN_COPY = {
  title: "Weather details",
  current: "Current conditions",
  feels: "Feels like",
  highLow: "High {high}° · Low {low}°",
  humidity: "Humidity",
  wind: "Wind",
  pressure: "Pressure",
  visibility: "Visibility",
  clouds: "Cloud cover",
  sunrise: "Sunrise",
  sunset: "Sunset",
  periods: "3-hour forecast",
  periodsBody: "The next 36 hours, in local time",
  daily: "5-day forecast",
  rain: "rain",
  air: "Air quality",
  pollutants: "Pollutants (µg/m³)",
  guidanceTitle: "Environmental guidance",
  updated: "Updated",
  retry: "Try again",
  loading: "Loading weather details",
  unavailable: "Weather details unavailable",
  unavailableBody: "Check your connection and try again.",
  forecastUnavailable: "Forecast is temporarily unavailable. Current conditions are still shown.",
  airUnavailable: "Air-quality data is temporarily unavailable.",
  back: "Go back",
  refresh: "Refresh weather",
  aqiLabels: ["Unknown", "Good", "Fair", "Moderate", "Poor", "Very poor"],
  airAssessments: [
    "Air-quality assessment is unavailable.",
    "Air quality is currently good.",
    "Air quality is currently fair.",
    "Air quality is moderate; sensitive people may prefer shorter outdoor activity.",
    "Air quality is poorer than usual; consider limiting prolonged outdoor activity.",
    "Air quality is very poor; avoid unnecessary prolonged outdoor activity.",
  ],
  alerts: {
    air: "Poor air quality: reduce prolonged outdoor activity.",
    storm: "Thunderstorms are forecast soon. Seek shelter when conditions worsen.",
    rain: "Heavy rain is likely soon. Allow extra travel time.",
    heat: "Extreme heat: hydrate and avoid strenuous midday activity.",
    wind: "Strong winds: secure loose outdoor items and use caution.",
  },
  guidance: {
    veryPoorAir: "If reporting outdoors, keep the visit brief and avoid unnecessary prolonged exertion.",
    sensitiveAir: "Sensitive people should shorten prolonged outdoor activity.",
    heavyRain: "When reporting flooding, take photos from a safe position and do not enter deep water.",
    rain: "Carry rain protection when documenting incidents during the next 12 hours.",
    heat: "When documenting an incident outdoors, hydrate and favor shaded, cooler routes.",
    wind: "When reporting outside, keep clear of trees, signs, and unsecured objects.",
    pleasant: "Conditions are generally suitable for normal outdoor activity.",
  } as Record<WeatherGuidanceCode, string>,
};

const VI_COPY = {
  title: "Chi tiết thời tiết",
  current: "Điều kiện hiện tại",
  feels: "Cảm giác như",
  highLow: "Cao {high}° · Thấp {low}°",
  humidity: "Độ ẩm",
  wind: "Gió",
  pressure: "Áp suất",
  visibility: "Tầm nhìn",
  clouds: "Mây che phủ",
  sunrise: "Bình minh",
  sunset: "Hoàng hôn",
  periods: "Dự báo mỗi 3 giờ",
  periodsBody: "36 giờ tiếp theo, theo giờ địa phương",
  daily: "Dự báo 5 ngày",
  rain: "mưa",
  air: "Chất lượng không khí",
  pollutants: "Chất ô nhiễm (µg/m³)",
  guidanceTitle: "Hướng dẫn môi trường",
  updated: "Cập nhật",
  retry: "Thử lại",
  loading: "Đang tải chi tiết thời tiết",
  unavailable: "Không thể tải chi tiết thời tiết",
  unavailableBody: "Hãy kiểm tra kết nối và thử lại.",
  forecastUnavailable: "Dự báo tạm thời không khả dụng. Điều kiện hiện tại vẫn được hiển thị.",
  airUnavailable: "Dữ liệu chất lượng không khí tạm thời không khả dụng.",
  back: "Quay lại",
  refresh: "Làm mới thời tiết",
  aqiLabels: ["Chưa rõ", "Tốt", "Khá", "Trung bình", "Kém", "Rất kém"],
  airAssessments: [
    "Chưa có đánh giá chất lượng không khí.",
    "Chất lượng không khí hiện ở mức tốt.",
    "Chất lượng không khí hiện ở mức khá.",
    "Chất lượng không khí ở mức trung bình; người nhạy cảm có thể rút ngắn hoạt động ngoài trời.",
    "Chất lượng không khí kém hơn bình thường; nên hạn chế hoạt động ngoài trời kéo dài.",
    "Chất lượng không khí rất kém; tránh hoạt động ngoài trời kéo dài không cần thiết.",
  ],
  alerts: {
    air: "Chất lượng không khí kém: hạn chế hoạt động ngoài trời kéo dài.",
    storm: "Sắp có giông. Hãy tìm nơi trú khi thời tiết xấu đi.",
    rain: "Sắp có khả năng mưa lớn. Hãy dành thêm thời gian di chuyển.",
    heat: "Nắng nóng cực đoan: uống đủ nước và tránh vận động mạnh giữa trưa.",
    wind: "Gió mạnh: cố định đồ vật ngoài trời và di chuyển thận trọng.",
  },
  guidance: {
    veryPoorAir: "Nếu cần báo cáo ngoài trời, hãy rút ngắn thời gian và tránh vận động kéo dài không cần thiết.",
    sensitiveAir: "Người nhạy cảm nên rút ngắn hoạt động ngoài trời kéo dài.",
    heavyRain: "Khi báo cáo ngập, hãy chụp ảnh từ vị trí an toàn và không đi vào vùng nước sâu.",
    rain: "Mang đồ che mưa khi ghi nhận sự cố trong 12 giờ tới.",
    heat: "Khi ra ngoài ghi nhận sự cố, hãy bổ sung nước và ưu tiên tuyến đường râm mát.",
    wind: "Khi báo cáo ngoài trời, hãy tránh xa cây, biển báo và vật dụng chưa cố định.",
    pleasant: "Điều kiện nhìn chung phù hợp cho hoạt động ngoài trời bình thường.",
  } as Record<WeatherGuidanceCode, string>,
};

const Skeleton = ({ color }: { color: string }) => (
  <View accessible accessibilityLabel="Loading weather details" accessibilityState={{ busy: true }}>
    <View style={[styles.skeletonHero, { backgroundColor: color }]} />
    <View style={styles.skeletonGrid}>
      {[0, 1, 2, 3].map((item) => (
        <View key={item} style={[styles.skeletonMetric, { backgroundColor: color }]} />
      ))}
    </View>
    <View style={[styles.skeletonSection, { backgroundColor: color }]} />
    <View style={[styles.skeletonSection, { backgroundColor: color }]} />
  </View>
);

export const WeatherDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const copy = language === "vi" ? VI_COPY : EN_COPY;
  const locale = language === "vi" ? "vi-VN" : "en-US";
  const query = useWeatherDetails(route.params.latitude, route.params.longitude);
  const details = query.data;

  const guidance = useMemo(
    () => (details ? getWeatherGuidance(details) : []),
    [details],
  );
  const alertCode = useMemo(
    () => (details ? getWeatherAlert(details) : null),
    [details],
  );

  const locationName = details?.location.name || route.params.locationLabel;
  const country = details?.location.country;
  const locationLabel = country ? `${locationName}, ${country}` : locationName;
  const timezoneOffset = details?.location.timezoneOffsetSeconds ?? 0;
  const currentDay = details
    ? getProviderLocalDate(Date.now(), timezoneOffset)
    : "";
  const today = details?.daily.find((day) => day.date === currentDay);
  const highLow = today
    ? copy.highLow
        .replace("{high}", String(Math.round(today.maxTemperature)))
        .replace("{low}", String(Math.round(today.minTemperature)))
    : null;
  const cardStyle = [
    styles.card,
    { backgroundColor: colors.card, borderColor: colors.border },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerButton, { backgroundColor: colors.background }]}
          accessibilityRole="button"
          accessibilityLabel={copy.back}
        >
          <ArrowLeft size={21} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{copy.title}</Text>
          <View style={styles.headerLocation}>
            <MapPin size={12} color={colors.textMuted} />
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {locationLabel}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => query.refetch()}
          disabled={query.isRefetching}
          style={[styles.headerButton, { backgroundColor: colors.background }]}
          accessibilityRole="button"
          accessibilityLabel={copy.refresh}
          accessibilityState={{ disabled: query.isRefetching, busy: query.isRefetching }}
        >
          <RefreshCw size={19} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isLoading}
            onRefresh={() => query.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {query.isLoading && !details ? <Skeleton color={colors.border} /> : null}

        {query.isError && !details ? (
          <View style={styles.fullError} accessible accessibilityRole="alert">
            <AlertTriangle size={42} color={colors.destructive} />
            <Text style={[styles.errorTitle, { color: colors.text }]}>{copy.unavailable}</Text>
            <Text style={[styles.errorBody, { color: colors.textMuted }]}>{copy.unavailableBody}</Text>
            <TouchableOpacity
              onPress={() => query.refetch()}
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel={copy.retry}
            >
              <RefreshCw size={16} color="#FFFFFF" />
              <Text style={styles.retryText}>{copy.retry}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {details ? (
          <>
            <View
              style={[
                styles.hero,
                {
                  backgroundColor: isDark ? "#122238" : "#EAF7FF",
                  borderColor: isDark ? "#29445F" : "#CFE7F7",
                },
              ]}
              accessible
              accessibilityLabel={`${copy.current}. ${Math.round(details.current.temperature)} degrees. ${getWeatherConditionDisplay(language, details.current.condition || details.current.description)}.`}
            >
              <View style={styles.heroTop}>
                <View style={styles.heroCopy}>
                  <Text style={[styles.eyebrow, { color: isDark ? "#67E8F9" : "#0369A1" }]}>
                    {copy.current}
                  </Text>
                  <Text style={[styles.heroDate, { color: colors.textMuted }]}>
                    {formatWeatherDate(Date.now(), timezoneOffset, locale)}
                  </Text>
                  <View style={styles.temperatureRow}>
                    <Text style={[styles.heroTemperature, { color: colors.text }]}>
                      {Math.round(details.current.temperature)}°
                    </Text>
                    {details.current.icon ? (
                      <Image
                        source={{ uri: details.current.icon }}
                        style={styles.heroIcon}
                        accessibilityIgnoresInvertColors
                        accessibilityLabel={getWeatherConditionDisplay(language, details.current.condition || details.current.description)}
                      />
                    ) : null}
                  </View>
                  <Text style={[styles.heroCondition, { color: colors.text }]}>
                    {getWeatherConditionDisplay(language, details.current.condition || details.current.description)}
                  </Text>
                  <Text style={[styles.heroMeta, { color: colors.textMuted }]}>
                    {copy.feels} {Math.round(details.current.feelsLike)}°{highLow ? ` · ${highLow}` : ""}
                  </Text>
                </View>
              </View>
            </View>

            {alertCode ? (
              <View
                style={[
                  styles.alertBanner,
                  {
                    backgroundColor: isDark ? "rgba(245,158,11,0.16)" : "#FFF7ED",
                    borderColor: isDark ? "rgba(251,191,36,0.38)" : "#FED7AA",
                  },
                ]}
                accessible
                accessibilityRole="alert"
              >
                <AlertTriangle size={20} color={colors.accent} />
                <Text style={[styles.alertText, { color: colors.text }]}>{copy.alerts[alertCode]}</Text>
              </View>
            ) : null}

            <View style={styles.metricGrid}>
              {[
                { label: copy.humidity, value: `${details.current.humidity}%`, icon: Droplets, color: "#38BDF8" },
                { label: copy.wind, value: `${details.current.windSpeed} km/h`, icon: Wind, color: "#14B8A6" },
                { label: copy.pressure, value: details.current.pressure == null ? "—" : `${details.current.pressure} hPa`, icon: Gauge, color: "#8B5CF6" },
                { label: copy.visibility, value: details.current.visibilityKm == null ? "—" : `${details.current.visibilityKm} km`, icon: Eye, color: "#0EA5E9" },
                { label: copy.clouds, value: details.current.cloudiness == null ? "—" : `${details.current.cloudiness}%`, icon: Cloud, color: "#64748B" },
                { label: copy.feels, value: `${Math.round(details.current.feelsLike)}°C`, icon: Thermometer, color: "#F97316" },
                { label: copy.sunrise, value: details.current.sunrise, icon: Sunrise, color: "#F59E0B" },
                { label: copy.sunset, value: details.current.sunset, icon: Sunset, color: "#F97316" },
              ].map((metric) => {
                const Icon = metric.icon;
                return (
                  <View key={metric.label} style={cardStyle} accessible accessibilityLabel={`${metric.label}: ${metric.value}`}>
                    <Icon size={19} color={metric.color} />
                    <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{metric.label}</Text>
                    <Text style={[styles.metricValue, { color: colors.text }]}>{metric.value}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{copy.periods}</Text>
                <Text style={[styles.sectionBody, { color: colors.textMuted }]}>{copy.periodsBody}</Text>
              </View>
              <CloudSun size={21} color={colors.secondary} />
            </View>
            {details.availability.forecast && details.hourly.length > 0 ? (
              <FlatList
                data={details.hourly}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.periodList}
                keyExtractor={(period) => period.timestamp}
                renderItem={({ item: period }) => (
                  <View
                    style={[styles.periodCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    accessible
                    accessibilityLabel={`${formatWeatherTime(period.timestamp, timezoneOffset, locale)}, ${Math.round(period.temperature)} degrees, ${getWeatherConditionDisplay(language, period.condition || period.description)}, ${period.precipitationProbability} percent ${copy.rain}`}
                  >
                    <Text style={[styles.periodTime, { color: colors.text }]}>
                      {formatWeatherTime(period.timestamp, timezoneOffset, locale)}
                    </Text>
                    {period.icon ? (
                      <Image source={{ uri: period.icon }} style={styles.periodIcon} accessibilityIgnoresInvertColors />
                    ) : null}
                    <Text style={[styles.periodTemperature, { color: colors.text }]}>{Math.round(period.temperature)}°</Text>
                    <View style={styles.rainRow}>
                      <Droplets size={12} color="#38BDF8" />
                      <Text style={[styles.rainText, { color: colors.textMuted }]}>{period.precipitationProbability}%</Text>
                    </View>
                  </View>
                )}
              />
            ) : (
              <View style={[styles.partialCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Cloud size={22} color={colors.textMuted} />
                <View style={styles.partialCopy}>
                  <Text style={[styles.partialText, { color: colors.textMuted }]}>{copy.forecastUnavailable}</Text>
                  <TouchableOpacity
                    onPress={() => query.refetch()}
                    style={styles.partialRetry}
                    accessibilityRole="button"
                    accessibilityLabel={copy.retry}
                  >
                    <RefreshCw size={14} color={colors.primary} />
                    <Text style={[styles.partialRetryText, { color: colors.primary }]}>{copy.retry}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{copy.daily}</Text>
              <Umbrella size={21} color={colors.secondary} />
            </View>
            {details.availability.forecast && details.daily.length > 0 ? (
              <View style={[styles.dailyList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {details.daily.map((day, index) => (
                  <View
                    key={day.date}
                    style={[styles.dailyRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}
                    accessible
                    accessibilityLabel={`${formatWeatherDay(day.date, locale)}. ${getWeatherConditionDisplay(language, day.condition || day.description)}. ${Math.round(day.minTemperature)} to ${Math.round(day.maxTemperature)} degrees. ${day.precipitationProbability} percent ${copy.rain}.`}
                  >
                    <View style={styles.dayCopy}>
                      <Text style={[styles.dayName, { color: colors.text }]} numberOfLines={1}>
                        {formatWeatherDay(day.date, locale)}
                      </Text>
                      <Text style={[styles.dayCondition, { color: colors.textMuted }]} numberOfLines={1}>
                        {getWeatherConditionDisplay(language, day.condition || day.description)}
                      </Text>
                    </View>
                    {day.icon ? <Image source={{ uri: day.icon }} style={styles.dayIcon} accessibilityIgnoresInvertColors /> : null}
                    <View style={styles.dayRain}>
                      <Droplets size={12} color="#38BDF8" />
                      <Text style={[styles.dayRainText, { color: colors.textMuted }]}>{day.precipitationProbability}%</Text>
                    </View>
                    <Text style={[styles.dayTemperature, { color: colors.text }]}>
                      {Math.round(day.minTemperature)}° / {Math.round(day.maxTemperature)}°
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{copy.air}</Text>
              <ShieldCheck size={21} color={colors.primary} />
            </View>
            {details.availability.airQuality && details.airQuality ? (
              <View style={[styles.airCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.airSummary}>
                  <View style={[styles.aqiBadge, { backgroundColor: details.airQuality.aqi <= 2 ? "#DCFCE7" : details.airQuality.aqi === 3 ? "#FEF3C7" : "#FEE2E2" }]}>
                    <Text style={[styles.aqiNumber, { color: details.airQuality.aqi <= 2 ? "#15803D" : details.airQuality.aqi === 3 ? "#B45309" : "#B91C1C" }]}>
                      {details.airQuality.aqi}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.airLabel, { color: colors.text }]}>
                      {copy.aqiLabels[details.airQuality.aqi] ?? copy.aqiLabels[0]}
                    </Text>
                    <Text style={[styles.airAssessment, { color: colors.textMuted }]}>
                      {copy.airAssessments[details.airQuality.aqi] ?? copy.airAssessments[0]}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.pollutantsTitle, { color: colors.textMuted }]}>{copy.pollutants}</Text>
                <View style={styles.pollutantGrid}>
                  {[
                    ["PM2.5", details.airQuality.pm2_5],
                    ["PM10", details.airQuality.pm10],
                    ["CO", details.airQuality.co],
                    ["NO₂", details.airQuality.no2],
                    ["O₃", details.airQuality.o3],
                  ].map(([label, value]) => (
                    <View key={String(label)} style={[styles.pollutant, { backgroundColor: colors.background }]}>
                      <Text style={[styles.pollutantLabel, { color: colors.textMuted }]}>{label}</Text>
                      <Text style={[styles.pollutantValue, { color: colors.text }]}>{value == null ? "—" : value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={[styles.partialCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ShieldCheck size={22} color={colors.textMuted} />
                <View style={styles.partialCopy}>
                  <Text style={[styles.partialText, { color: colors.textMuted }]}>{copy.airUnavailable}</Text>
                  <TouchableOpacity
                    onPress={() => query.refetch()}
                    style={styles.partialRetry}
                    accessibilityRole="button"
                    accessibilityLabel={copy.retry}
                  >
                    <RefreshCw size={14} color={colors.primary} />
                    <Text style={[styles.partialRetryText, { color: colors.primary }]}>{copy.retry}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{copy.guidanceTitle}</Text>
            </View>
            <View style={[styles.guidanceCard, { backgroundColor: isDark ? "rgba(34,197,94,0.12)" : "#F0FDF4", borderColor: isDark ? "rgba(74,222,128,0.3)" : "#BBF7D0" }]}>
              {guidance.map((code) => (
                <View key={code} style={styles.guidanceRow}>
                  <View style={[styles.guidanceDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.guidanceText, { color: colors.text }]}>{copy.guidance[code]}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.updatedText, { color: colors.textMuted }]}>
              {copy.updated} {formatWeatherTime(details.fetchedAt, timezoneOffset, locale)}
            </Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { minHeight: 66, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  headerButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800" },
  headerLocation: { maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  headerSubtitle: { flexShrink: 1, fontSize: 11, fontWeight: "600" },
  content: { padding: 16, paddingBottom: 40 },
  hero: { borderRadius: 24, borderWidth: 1, padding: 20, overflow: "hidden" },
  heroTop: { flexDirection: "row", justifyContent: "space-between" },
  heroCopy: { flex: 1 },
  eyebrow: { fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  temperatureRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 84 },
  heroTemperature: { fontSize: 66, lineHeight: 78, fontWeight: "800", letterSpacing: -3 },
  heroIcon: { width: 88, height: 88 },
  heroCondition: { fontSize: 20, fontWeight: "800", textTransform: "capitalize" },
  heroDate: { fontSize: 12, fontWeight: "600", marginTop: 5, textTransform: "capitalize" },
  heroMeta: { fontSize: 13, lineHeight: 20, marginTop: 4 },
  alertBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 12 },
  alertText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  card: { width: "48%", flexGrow: 1, minHeight: 94, borderWidth: 1, borderRadius: 16, padding: 13 },
  metricLabel: { fontSize: 11, marginTop: 8 },
  metricValue: { fontSize: 15, fontWeight: "800", marginTop: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 26, marginBottom: 10, gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  sectionBody: { fontSize: 11, marginTop: 2 },
  periodList: { gap: 9, paddingRight: 8 },
  periodCard: { width: 86, minHeight: 140, borderWidth: 1, borderRadius: 17, paddingVertical: 11, alignItems: "center" },
  periodTime: { fontSize: 12, fontWeight: "800" },
  periodIcon: { width: 48, height: 48 },
  periodTemperature: { fontSize: 19, fontWeight: "800" },
  rainRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 6 },
  rainText: { fontSize: 11, fontWeight: "700" },
  partialCard: { minHeight: 90, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16, padding: 16 },
  partialCopy: { flex: 1 },
  partialText: { fontSize: 13, lineHeight: 19 },
  partialRetry: { minHeight: 36, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  partialRetryText: { fontSize: 12, fontWeight: "800" },
  dailyList: { borderWidth: 1, borderRadius: 18, overflow: "hidden" },
  dailyRow: { minHeight: 66, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 7 },
  dayCopy: { flex: 1, minWidth: 0 },
  dayName: { fontSize: 13, fontWeight: "700", textTransform: "capitalize" },
  dayCondition: { fontSize: 10, marginTop: 2, textTransform: "capitalize" },
  dayIcon: { width: 42, height: 42 },
  dayRain: { width: 42, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2 },
  dayRainText: { fontSize: 10, fontWeight: "700" },
  dayTemperature: { width: 74, textAlign: "right", fontSize: 13, fontWeight: "800" },
  airCard: { borderWidth: 1, borderRadius: 18, padding: 16 },
  airSummary: { flexDirection: "row", alignItems: "center", gap: 12 },
  aqiBadge: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  aqiNumber: { fontSize: 21, fontWeight: "900" },
  airLabel: { fontSize: 17, fontWeight: "800" },
  airAssessment: { maxWidth: 245, fontSize: 11, lineHeight: 16, marginTop: 2 },
  pollutantsTitle: { fontSize: 11, fontWeight: "700", marginTop: 14 },
  pollutantGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  pollutant: { minWidth: 58, flexGrow: 1, borderRadius: 12, padding: 9, alignItems: "center" },
  pollutantLabel: { fontSize: 10, fontWeight: "700" },
  pollutantValue: { fontSize: 13, fontWeight: "800", marginTop: 2 },
  guidanceCard: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 11 },
  guidanceRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  guidanceDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  guidanceText: { flex: 1, fontSize: 13, lineHeight: 19 },
  updatedText: { marginTop: 18, textAlign: "center", fontSize: 11 },
  fullError: { minHeight: 420, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  errorTitle: { fontSize: 19, fontWeight: "800", marginTop: 14 },
  errorBody: { textAlign: "center", fontSize: 13, lineHeight: 19, marginTop: 6 },
  retryButton: { minHeight: 44, borderRadius: 14, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18 },
  retryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  skeletonHero: { height: 218, borderRadius: 24, opacity: 0.55 },
  skeletonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  skeletonMetric: { width: "48%", flexGrow: 1, height: 94, borderRadius: 16, opacity: 0.45 },
  skeletonSection: { height: 150, borderRadius: 18, marginTop: 26, opacity: 0.45 },
});

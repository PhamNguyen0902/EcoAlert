import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, MapPin } from "lucide-react-native";
import { useAlert } from "../hooks/useAlerts";
import type { RootStackParamList } from "../navigation/types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useTheme } from "../context/ThemeContext";
import { getGeoJsonMapCoordinates, openGoogleMaps } from "../utils/maps";

type Props = NativeStackScreenProps<RootStackParamList, "AlertDetail">;

const formatAddressLines = (address: string | undefined): string[] => {
  const lines = address?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];
  return lines.length > 0 ? lines : ["Address unavailable"];
};

export const AlertDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { data: alert, isLoading, isError } = useAlert(route.params.id);
  const mapCoordinates = getGeoJsonMapCoordinates(alert?.location?.coordinates);
  const addressLines = useMemo(() => formatAddressLines(alert?.address), [alert?.address]);

  const openInGoogleMaps = async () => {
    if (!mapCoordinates) {
      Alert.alert("Không có vị trí", "Vị trí sự cố không có sẵn.");
      return;
    }

    const result = await openGoogleMaps(
      mapCoordinates.latitude,
      mapCoordinates.longitude,
      "view",
    );
    if (!result.success) {
      Alert.alert("Không thể mở bản đồ", "Vui lòng thử lại hoặc mở vị trí trong trình duyệt.");
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError || !alert) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.destructive }]}>Không thể tải báo cáo sự cố này.</Text>
        <Button title="Quay lại" variant="outline" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text }]}>{alert.title}</Text>
        <View style={styles.badges}>
          <Badge label={alert.status || "PENDING"} type="status" />
          <Badge
            label={alert.category || "General"}
            type="custom"
            bgColor={isDark ? "rgba(71, 85, 105, 0.4)" : "#F1F5F9"}
            textColor={isDark ? "#CBD5E1" : "#475569"}
          />
        </View>

        <Card style={styles.descriptionCard}>
          <Text style={[styles.cardLabel, { color: colors.text }]}>Chi tiết sự cố</Text>
          <Text style={[styles.description, { color: colors.textMuted }]}>{alert.description}</Text>
        </Card>

        <Card style={styles.locationCard}>
          <View style={styles.locationHeading}>
            <View style={[styles.locationIcon, { backgroundColor: isDark ? "rgba(34, 197, 94, 0.2)" : colors.primaryLight }]}>
              <MapPin size={21} color={colors.primary} />
            </View>
            <Text style={[styles.locationTitle, { color: colors.text }]}>Vị trí</Text>
          </View>

          <View style={styles.addressLines}>
            {addressLines.map((line, index) => (
              <Text key={index} style={[styles.addressLine, { color: colors.text }]}>
                {line}
              </Text>
            ))}
          </View>

          {mapCoordinates ? (
            <View style={[styles.coordinates, { borderTopColor: colors.border }]}>
              <View style={styles.coordinateRow}>
                <Text style={[styles.coordinateLabel, { color: colors.textMuted }]}>Vĩ độ:</Text>
                <Text style={[styles.coordinateValue, { color: colors.text }]}>
                  {mapCoordinates.latitude.toFixed(6)}
                </Text>
              </View>
              <View style={styles.coordinateRow}>
                <Text style={[styles.coordinateLabel, { color: colors.textMuted }]}>Kinh độ:</Text>
                <Text style={[styles.coordinateValue, { color: colors.text }]}>
                  {mapCoordinates.longitude.toFixed(6)}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.coordinateUnavailable, { color: colors.textMuted }]}>Tọa độ GPS không khả dụng cho báo cáo này.</Text>
          )}

          {mapCoordinates ? (
            <Button
              title="Mở trong Google Maps"
              onPress={openInGoogleMaps}
              style={styles.mapsButton}
              icon={<MapPin size={18} color="#FFF" style={styles.mapsIcon} />}
            />
          ) : null}
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    marginBottom: 18,
    borderWidth: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  descriptionCard: {
    marginTop: 20,
    padding: 18,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  locationCard: {
    marginTop: 16,
    padding: 18,
  },
  locationHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  locationIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  addressLines: {
    marginTop: 16,
    gap: 3,
  },
  addressLine: {
    fontSize: 15,
    lineHeight: 21,
  },
  coordinates: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 7,
  },
  coordinateRow: {
    flexDirection: "row",
  },
  coordinateLabel: {
    width: 88,
    fontSize: 13,
    fontWeight: "700",
  },
  coordinateValue: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  coordinateUnavailable: {
    marginTop: 16,
    fontSize: 13,
  },
  mapsButton: {
    marginTop: 20,
  },
  mapsIcon: {
    marginRight: 8,
  },
  errorText: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
});

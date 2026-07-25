import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import { MapPin, Navigation, Send, AlertCircle } from "lucide-react-native";
import { useCreateAlert } from "../hooks/useAlerts";
import { useLocation } from "../hooks/useLocation";
import { GlassCard } from "../components/ui/GlassCard";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { COLORS, SEVERITY_COLORS } from "../utils/constants";
import { AlertCategory, Severity } from "../types";

const CATEGORIES: { label: string; value: AlertCategory; icon: string }[] = [
  { label: "Illegal Dumping", value: "illegal_dumping", icon: "🗑️" },
  { label: "Water Pollution", value: "water_pollution", icon: "💧" },
  { label: "Air Pollution", value: "air_pollution", icon: "💨" },
  { label: "Illegal Burning", value: "illegal_burning", icon: "🔥" },
  { label: "Flooding", value: "flooding", icon: "🌊" },
  { label: "Fallen Tree", value: "fallen_tree", icon: "🌳" },
  { label: "Noise Pollution", value: "noise_pollution", icon: "🔊" },
  { label: "Other Incident", value: "other", icon: "⚠️" },
];

const SEVERITIES: { label: string; value: Severity }[] = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Critical", value: "critical" },
];

export const ReportIncidentScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const createAlertMutation = useCreateAlert();
  const { coords, address, loading: locLoading, error: locError, fetchLocation, setManualLocation } = useLocation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<AlertCategory>("illegal_dumping");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [errors, setErrors] = useState<{ title?: string; description?: string; location?: string }>({});

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  const validate = () => {
    const errs: { title?: string; description?: string; location?: string } = {};
    if (!title.trim() || title.length < 5) {
      errs.title = "Please enter an incident title (at least 5 characters).";
    }
    if (!description.trim() || description.length < 15) {
      errs.description = "Please describe the incident (at least 15 characters).";
    }
    if (!coords) {
      errs.location = "Please select or retrieve GPS coordinates on the map.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      await createAlertMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        location: coords!,
        address: address || "Unknown Location",
      });

      Alert.alert(
        "Incident Reported",
        "Your environmental report has been submitted to EcoAlert officers for verification.",
        [
          {
            text: "OK",
            onPress: () => {
              setTitle("");
              setDescription("");
              if (navigation) {
                navigation.navigate("DashboardTab");
              }
            },
          },
        ]
      );
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to submit report.";
      Alert.alert("Submission Error", msg);
    }
  };

  const initialRegion = {
    latitude: coords ? coords.coordinates[1] : 10.762622,
    longitude: coords ? coords.coordinates[0] : 106.660172,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoid}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0} // Đẩy view lên tránh bị bottom tab che
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled" // CỰC KỲ QUAN TRỌNG: Sửa lỗi giật/mất focus bàn phím
        bounces={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Report Incident</Text>
          <Text style={styles.headerSubtitle}>
            Submit real-time geotagged alerts to municipal environmental officers.
          </Text>
        </View>

        {/* Category Selector */}
        <Text style={styles.sectionLabel}>Select Incident Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll} keyboardShouldPersistTaps="handled">
          {CATEGORIES.map((cat) => {
            const isSelected = category === cat.value;
            return (
              <TouchableOpacity
                key={cat.value}
                activeOpacity={0.8}
                onPress={() => setCategory(cat.value)}
                style={[styles.catChip, isSelected && styles.catChipSelected]}
              >
                <Text style={styles.catIcon}>{cat.icon}</Text>
                <Text style={[styles.catText, isSelected && styles.catTextSelected]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Severity Selector */}
        <Text style={styles.sectionLabel}>Severity Priority Level</Text>
        <View style={styles.severityContainer}>
          {SEVERITIES.map((sev) => {
            const isSelected = severity === sev.value;
            const sevColor = SEVERITY_COLORS[sev.value] || { bg: "#F1F5F9", text: "#475569" };
            return (
              <TouchableOpacity
                key={sev.value}
                activeOpacity={0.8}
                onPress={() => setSeverity(sev.value)}
                style={[
                  styles.sevChip,
                  { backgroundColor: isSelected ? sevColor.text : sevColor.bg },
                  isSelected && { borderColor: sevColor.text },
                ]}
              >
                <Text style={[styles.sevText, { color: isSelected ? "#FFFFFF" : sevColor.text }]}>
                  {sev.label.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Form Fields */}
        <GlassCard style={styles.formCard}>
          <Input
            label="Incident Title"
            placeholder="e.g. Chemical waste dumping in river"
            value={title}
            onChangeText={setTitle}
            error={errors.title}
          />

          <Input
            label="Detailed Description"
            placeholder="Provide details: what is happening, approximate volume, hazards observed..."
            multiline
            numberOfLines={4}
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            error={errors.description}
          />
        </GlassCard>

        {/* Geolocation Section with React Native Maps */}
        <View style={styles.mapHeader}>
          <Text style={styles.sectionLabel}>Incident Location (GPS)</Text>
          <TouchableOpacity style={styles.gpsButton} onPress={fetchLocation} disabled={locLoading}>
            {locLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <Navigation size={14} color={COLORS.primary} />
                <Text style={styles.gpsText}>Locate Me</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Card style={styles.mapCard}>
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              initialRegion={initialRegion}
              region={
                coords
                  ? {
                      latitude: coords.coordinates[1],
                      longitude: coords.coordinates[0],
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }
                  : undefined
              }
              onPress={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                setManualLocation(latitude, longitude);
              }}
            >
              {coords ? (
                <Marker
                  coordinate={{
                    latitude: coords.coordinates[1],
                    longitude: coords.coordinates[0],
                  }}
                  title="Incident Location"
                  description={address || "Selected coordinates"}
                  draggable
                  onDragEnd={(e) => {
                    const { latitude, longitude } = e.nativeEvent.coordinate;
                    setManualLocation(latitude, longitude);
                  }}
                />
              ) : null}
            </MapView>
          </View>

          <View style={styles.addressBox}>
            <MapPin size={18} color={COLORS.primary} />
            <Text style={styles.addressText} numberOfLines={2}>
              {address || "Tap map or click 'Locate Me' to set position"}
            </Text>
          </View>
          {locError ? <Text style={styles.errorText}>{locError}</Text> : null}
          {errors.location ? <Text style={styles.errorText}>{errors.location}</Text> : null}
        </Card>

        {/* Submit Button */}
        <Button
          title="Submit Incident Report"
          onPress={handleSubmit}
          loading={createAlertMutation.isPending}
          style={styles.submitBtn}
          icon={<Send size={18} color="#FFF" style={{ marginRight: 8 }} />}
        />

        <View style={styles.infoBox}>
          <AlertCircle size={14} color={COLORS.textMuted} />
          <Text style={styles.infoText}>
            False reports or malicious submissions may result in citizen account suspension.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 80, // Tăng padding để có không gian khi cuộn
  },
  header: {
    marginVertical: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 10,
    marginTop: 12,
  },
  catScroll: {
    paddingBottom: 8,
    gap: 10,
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  catChipSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  catIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  catText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  catTextSelected: {
    color: COLORS.primaryDark,
    fontWeight: "700",
  },
  severityContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  sevChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  sevText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  formCard: {
    padding: 20,
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  gpsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  gpsText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  mapCard: {
    padding: 0,
    overflow: "hidden",
    marginBottom: 24,
  },
  mapContainer: {
    height: 220,
    width: "100%",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  addressBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  addressText: {
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
    fontWeight: "500",
  },
  errorText: {
    fontSize: 12,
    color: COLORS.destructive,
    paddingHorizontal: 14,
    paddingBottom: 10,
    fontWeight: "600",
  },
  submitBtn: {
    marginTop: 8,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    gap: 6,
    paddingHorizontal: 20,
  },
  infoText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: "center",
  },
});
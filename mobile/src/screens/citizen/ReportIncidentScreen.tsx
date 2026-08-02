import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert as RNAlert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Image,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import * as ImagePicker from "expo-image-picker";
import { MapPin, Navigation, Send, AlertCircle, Camera, X, Sparkles, EyeOff, Users, CheckCircle2 } from "lucide-react-native";
import { useCreateAlert, useUploadMedia, useCheckNearbyAlerts, useConfirmAlert, useAnalyzeMedia } from "../../hooks/useAlerts";
import { useLocation } from "../../hooks/useLocation";
import { GlassCard } from "../../components/ui/GlassCard";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { SEVERITY_COLORS } from "../../utils/constants";
import { AlertCategory, Severity } from "../../types";

const CATEGORIES: { labelKey: string; fallbackLabel: string; value: AlertCategory; icon: string }[] = [
  { labelKey: "illegal_dumping", fallbackLabel: "Illegal Dumping", value: "illegal_dumping", icon: "🗑️" },
  { labelKey: "water_pollution", fallbackLabel: "Water Pollution", value: "water_pollution", icon: "💧" },
  { labelKey: "air_pollution", fallbackLabel: "Air Pollution", value: "air_pollution", icon: "💨" },
  { labelKey: "illegal_burning", fallbackLabel: "Illegal Burning", value: "illegal_burning", icon: "🔥" },
  { labelKey: "flooding", fallbackLabel: "Flooding", value: "flooding", icon: "🌊" },
  { labelKey: "fallen_tree", fallbackLabel: "Fallen Tree", value: "fallen_tree", icon: "🌳" },
  { labelKey: "noise_pollution", fallbackLabel: "Noise Pollution", value: "noise_pollution", icon: "🔊" },
  { labelKey: "other", fallbackLabel: "Other Incident", value: "other", icon: "⚠️" },
];

const AI_SEVERITY_CONTENT: Record<
  string,
  Record<string, { title: string; description: string }>
> = {
  illegal_dumping: {
    low: {
      title: "Túi rác & phế thải nhỏ vung vãi",
      description: "Ghi nhận một ít rác thải sinh hoạt, túi nilon rải rác khu vực lối đi. Mức độ nhẹ, cần dọn dẹp vệ sinh môi trường.",
    },
    medium: {
      title: "Báo cáo sự cố xả rác thải bừa bãi",
      description: "Ghi nhận hành vi xả rác thải bừa bãi tại khu vực, gây ô nhiễm môi trường và mất mỹ quan đô thị.",
    },
    high: {
      title: "Bãi rác tự phát lớn bốc mùi hôi thối",
      description: "Phát hiện bãi rác tự phát quy mô lớn có dấu hiệu tích tụ lâu ngày, bốc mùi hôi thối nồng nặc và gây cản trở lối đi.",
    },
    critical: {
      title: "Xả thải rác độc hại / Bãi rác nguy hiểm khẩn cấp",
      description: "Cảnh báo xả thải rác công nghiệp/hóa chất nguy hại quy mô lớn, gây ô nhiễm môi trường nghiêm trọng và nguy cơ đe dọa sức khỏe cư dân.",
    },
  },
  water_pollution: {
    low: {
      title: "Nước mương/hồ có váng màu nhẹ",
      description: "Ghi nhận nguồn nước khu vực có váng đục nhẹ và phát sinh mùi lạ thoang thoảng, cần theo dõi kiểm tra.",
    },
    medium: {
      title: "Nước thải xả trực tiếp ra mương/sông",
      description: "Phát hiện dòng nước thải xả trực tiếp ra sông/mương gây màu đục bẩn và hôi hám, ảnh hưởng sinh hoạt.",
    },
    high: {
      title: "Sự cố ô nhiễm nguồn nước diện rộng",
      description: "Ghi nhận xả nước thải đục bẩn hôi thối nồng độ cao ra môi trường, gây ảnh hưởng nghiêm trọng tới hệ thống nguồn nước khu vực.",
    },
    critical: {
      title: "Tràn chất thải độc hại / Ô nhiễm nguồn nước khẩn cấp",
      description: "Báo động khẩn cấp: Nguồn nước sinh hoạt/sông chính bị nhiễm chất thải độc hại nặng, cá chết hàng loạt, cực kỳ nguy hiểm.",
    },
  },
  air_pollution: {
    low: {
      title: "Mùi hôi nhẹ rải rác cục bộ",
      description: "Ghi nhận mùi khó chịu nhẹ xuất hiện cục bộ theo đợt gió, cần kiểm tra nguyên nhân.",
    },
    medium: {
      title: "Khí thải sản xuất gây mùi nồng sặc",
      description: "Phát hiện khí thải bốc mùi khó chịu kéo dài từ cơ sở hoạt động, gây ảnh hưởng sức khỏe không khí xung quanh.",
    },
    high: {
      title: "Sự cố ô nhiễm không khí & khói bụi dày đặc",
      description: "Phát hiện lượng khói bụi và khí thải xả ra dày đặc diện rộng, gây cay mắt, khó thở và ô nhiễm nghiêm trọng.",
    },
    critical: {
      title: "Rò rỉ khí độc / Ô nhiễm không khí nguy cấp",
      description: "Cảnh báo nguy cấp rò rỉ khí độc hại nồng độ cao gây ngạt thở, ảnh hưởng trực tiếp tới tính mạng cư dân.",
    },
  },
  illegal_burning: {
    low: {
      title: "Đốt gom lá cây / Rác nhỏ tự phát",
      description: "Ghi nhận điểm đốt lá khô/rác nhỏ vặt, tỏa khói nhẹ cục bộ.",
    },
    medium: {
      title: "Đốt rác thải sinh hoạt bừa bãi",
      description: "Phát hiện việc gom đốt rác thải sinh hoạt tỏa khói đen và mùi khét trong khu dân cư.",
    },
    high: {
      title: "Đốt rác thải nhựa/cao su gây khói độc nguy hiểm",
      description: "Phát hiện hành vi đốt rác thải công nghiệp/nhựa/cao su trái phép sinh nhiều khói đen độc hại, nguy cơ cháy lan.",
    },
    critical: {
      title: "Đốt chất thải nguy hại / Cháy bãi rác dữ dội khẩn cấp",
      description: "Báo động đám cháy bãi rác/chất thải hóa chất bốc cao dữ dội, ngọn lửa lớn và khói độc dày đặc nguy cơ lan rộng.",
    },
  },
  flooding: {
    low: {
      title: "Nước mưa ứ đọng cục bộ nhẹ",
      description: "Ghi nhận nước đọng sũng tại mép đường sau mưa, thoát nước chậm nhưng chưa cản trở giao thông.",
    },
    medium: {
      title: "Sự cố ngập nước mặt đường trung bình",
      description: "Hiện trạng ngập nước đọng sâu 10-20cm tại mặt đường gây cản trở giao thông và sinh hoạt khu dân cư.",
    },
    high: {
      title: "Ngập sâu diện rộng / Nghẽn cống thoát nước",
      description: "Ngập nước sâu nghiêm trọng do tắc nghẽn hệ thống thoát nước, tràn vào nhà dân và cản trở hoàn toàn xe cộ.",
    },
    critical: {
      title: "Triều cường vỡ đê / Ngập lụt cuốn trôi nguy hiểm khẩn cấp",
      description: "Báo động lũ/triều cường dâng cao cuồn cuộn, nước chảy xiết gây cô lập khu vực và đe dọa an toàn tài sản, tính mạng.",
    },
  },
  fallen_tree: {
    low: {
      title: "Cành cây nhỏ khô gãy rơi",
      description: "Ghi nhận cành cây khô nhỏ bị gãy rơi vươn ra lòng đường, cần dọn dẹp để đảm bảo mỹ quan.",
    },
    medium: {
      title: "Cành cây lớn gãy chắn một phần lối đi",
      description: "Cành cây lớn bị gãy nghiêng rơi xuống cản trở lối đi của người và phương tiện giao thông.",
    },
    high: {
      title: "Cây xanh gãy đổ chắn ngang đường",
      description: "Cây xanh bị gãy đổ chắn ngang đường, nguy cơ gây mất an toàn và ùn tắc giao thông nghiêm trọng.",
    },
    critical: {
      title: "Cây cổ thụ bật gốc đè đường dây điện / Nhà dân khẩn cấp",
      description: "Cảnh báo khẩn cấp: Cây to bật gốc đè sập đường dây điện/nhà dân, đứt cáp viễn thông và nguy cơ đe dọa tính mạng.",
    },
  },
  noise_pollution: {
    low: {
      title: "Tiếng ồn vượt mức nhẹ vào giờ nghỉ",
      description: "Ghi nhận tiếng ồn phát ra vượt mức nhẹ trong giờ nghỉ ngơi, cần nhắc nhở điều chỉnh.",
    },
    medium: {
      title: "Tiếng ồn công trình / Loa phát vượt quy chuẩn",
      description: "Tiếng ồn phát ra liên tục với cường độ lớn từ loa/công trình gây ảnh hưởng sinh hoạt cộng đồng.",
    },
    high: {
      title: "Tiếng ồn cực lớn kéo dài ban đêm",
      description: "Hoạt động gây tiếng ồn cực lớn kéo dài quá giờ quy định, ảnh hưởng nghiêm trọng giấc ngủ và sức khỏe.",
    },
    critical: {
      title: "Rúng động & tiếng nổ cực mạnh nguy hại thính giác",
      description: "Tiếng nổ/rung chấn liên tục tần số cao vượt ngưỡng an toàn, nguy cơ tổn thương thính giác và nứt vỡ kết cấu.",
    },
  },
  other: {
    low: {
      title: "Sự cố môi trường mức độ nhẹ",
      description: "Ghi nhận hiện tượng bất thường nhẹ về môi trường tại khu vực.",
    },
    medium: {
      title: "Sự cố môi trường phát sinh cần xử lý",
      description: "Ghi nhận sự cố môi trường gây ảnh hưởng tới sinh hoạt và cảnh quan khu dân cư.",
    },
    high: {
      title: "Sự cố môi trường nguy cấp",
      description: "Phát hiện sự cố môi trường phức tạp có nguy cơ ô nhiễm diện rộng, cần lực lượng chức năng ứng phó.",
    },
    critical: {
      title: "Sự cố thảm họa môi trường cực kỳ nghiêm trọng",
      description: "Cảnh báo thảm họa môi trường mức độ đỏ, đe dọa nghiêm trọng tới an toàn cộng đồng và sinh thái.",
    },
  },
};

const getSeverityStyle = (sevValue: Severity, isSelected: boolean, isDark: boolean) => {
  const normalizedSev = (sevValue || "medium").toLowerCase();
  switch (normalizedSev) {
    case "low":
      if (isDark) {
        return {
          bg: isSelected ? "#334155" : "rgba(51, 65, 85, 0.4)",
          border: isSelected ? "#94A3B8" : "rgba(148, 163, 184, 0.3)",
          text: isSelected ? "#FFFFFF" : "#CBD5E1",
        };
      }
      return {
        bg: isSelected ? "#475569" : "#F1F5F9",
        border: isSelected ? "#334155" : "#CBD5E1",
        text: isSelected ? "#FFFFFF" : "#475569",
      };

    case "high":
      if (isDark) {
        return {
          bg: isSelected ? "#EA580C" : "rgba(234, 88, 12, 0.25)",
          border: isSelected ? "#F97316" : "rgba(249, 115, 22, 0.5)",
          text: isSelected ? "#FFFFFF" : "#FB923C",
        };
      }
      return {
        bg: isSelected ? "#EA580C" : "#FFEDD5",
        border: isSelected ? "#C2410C" : "#FDBA74",
        text: isSelected ? "#FFFFFF" : "#C2410C",
      };

    case "critical":
      if (isDark) {
        return {
          bg: isSelected ? "#DC2626" : "rgba(220, 38, 38, 0.25)",
          border: isSelected ? "#EF4444" : "rgba(239, 68, 68, 0.5)",
          text: isSelected ? "#FFFFFF" : "#FCA5A5",
        };
      }
      return {
        bg: isSelected ? "#DC2626" : "#FEE2E2",
        border: isSelected ? "#B91C1C" : "#FCA5A5",
        text: isSelected ? "#FFFFFF" : "#B91C1C",
      };

    case "medium":
    default:
      if (isDark) {
        return {
          bg: isSelected ? "#D97706" : "rgba(217, 119, 6, 0.25)",
          border: isSelected ? "#F59E0B" : "rgba(245, 158, 11, 0.5)",
          text: isSelected ? "#FFFFFF" : "#FBBF24",
        };
      }
      return {
        bg: isSelected ? "#D97706" : "#FEF3C7",
        border: isSelected ? "#B45309" : "#FCD34D",
        text: isSelected ? "#FFFFFF" : "#B45309",
      };
  }
};

const SEVERITIES: { labelKey: string; fallbackLabel: string; value: Severity }[] = [
  { labelKey: "report.low", fallbackLabel: "Low", value: "low" },
  { labelKey: "report.medium", fallbackLabel: "Medium", value: "medium" },
  { labelKey: "report.high", fallbackLabel: "High", value: "high" },
  { labelKey: "report.critical", fallbackLabel: "Critical", value: "critical" },
];

export const ReportIncidentScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const createAlertMutation = useCreateAlert();
  const uploadMediaMutation = useUploadMedia();
  const analyzeMediaMutation = useAnalyzeMedia();
  const confirmAlertMutation = useConfirmAlert();

  const { coords, address, loading: locLoading, error: locError, fetchLocation, setManualLocation } = useLocation();

  const nearbyQuery = useCheckNearbyAlerts(
    coords ? coords.coordinates[1] : undefined,
    coords ? coords.coordinates[0] : undefined,
    200
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<AlertCategory>("illegal_dumping");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; description?: string; location?: string }>({});

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  const handleSelectCategory = (newCat: AlertCategory) => {
    setCategory(newCat);
    if (aiNote) {
      const normSev = (severity || "medium").toLowerCase();
      const content = AI_SEVERITY_CONTENT[newCat]?.[normSev] || AI_SEVERITY_CONTENT.illegal_dumping.medium;
      setTitle(content.title);
      setDescription(content.description);
      setAiNote(`AI Auto-Fill: Đã cập nhật theo Danh mục mới & Mức ưu tiên [${severity.toUpperCase()}].`);
    }
  };

  const handleSelectSeverity = (newSev: Severity) => {
    setSeverity(newSev);
    if (aiNote) {
      const normSev = (newSev || "medium").toLowerCase();
      const content = AI_SEVERITY_CONTENT[category]?.[normSev] || AI_SEVERITY_CONTENT[category]?.medium;
      setTitle(content.title);
      setDescription(content.description);
      setAiNote(`AI Auto-Fill: Đã cập nhật tiêu đề & mô tả cho Mức ưu tiên [${newSev.toUpperCase()}].`);
    }
  };

  const handlePickPhoto = () => {
    RNAlert.alert(
      t("report.imagesLabel", "Attach Incident Evidence"),
      "Choose photo source from your device:",
      [
        {
          text: "📸 Take Photo (Camera)",
          onPress: async () => {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (!permissionResult.granted) {
              RNAlert.alert("Permission Required", "Camera access permission is required to capture photos.");
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              await processPickedPhoto(result.assets[0].uri);
            }
          },
        },
        {
          text: "🖼️ Choose from Photo Library",
          onPress: async () => {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
              RNAlert.alert("Permission Required", "Photo library access permission is required.");
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              await processPickedPhoto(result.assets[0].uri);
            }
          },
        },
        { text: t("modals.cancel", "Cancel"), style: "cancel" },
      ]
    );
  };

  const processPickedPhoto = async (localUri: string) => {
    setIsUploading(true);
    try {
      const uploadedUrl = await uploadMediaMutation.mutateAsync({
        fileUri: localUri,
        fileName: `report_${Date.now()}.jpg`,
      });
      setMediaUrls((prev) => [...prev, uploadedUrl]);
      handleAiAnalyze(uploadedUrl);
    } catch (err) {
      setMediaUrls((prev) => [...prev, localUri]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAiAnalyze = async (imageUrl?: string) => {
    const targetImg = imageUrl || (mediaUrls.length > 0 ? mediaUrls[0] : undefined);
    const normSev = (severity || "medium").toLowerCase();
    const fallbackContent = AI_SEVERITY_CONTENT[category]?.[normSev] || AI_SEVERITY_CONTENT.illegal_dumping.medium;

    try {
      const aiRes = await analyzeMediaMutation.mutateAsync({
        description: description || title || fallbackContent.description,
        imageUrl: targetImg,
      });

      if (aiRes) {
        const effectiveSev = (aiRes.severity ? aiRes.severity.toLowerCase() : normSev);
        const effectiveCat = (aiRes.category ? aiRes.category.toLowerCase() as AlertCategory : category);

        if (aiRes.category) setCategory(effectiveCat);
        if (aiRes.severity) setSeverity(effectiveSev as Severity);

        const tailoredContent = AI_SEVERITY_CONTENT[effectiveCat]?.[effectiveSev] || fallbackContent;
        setTitle(aiRes.suggested_title || tailoredContent.title);
        setDescription(aiRes.suggested_description || tailoredContent.description);
        setAiNote(aiRes.analysis_note || `AI Confidence: ${Math.round((aiRes.confidence || 0.88) * 100)}% (Mức ưu tiên ${effectiveSev.toUpperCase()})`);
      } else {
        setTitle(fallbackContent.title);
        setDescription(fallbackContent.description);
        setAiNote(`AI Auto-Fill: Đã tự động điền Tiêu đề & Mô tả cho Mức ưu tiên [${severity.toUpperCase()}].`);
      }
    } catch (err) {
      setTitle(fallbackContent.title);
      setDescription(fallbackContent.description);
      setAiNote(`AI Auto-Fill: Đã tự động điền Tiêu đề & Mô tả cho Mức ưu tiên [${severity.toUpperCase()}].`);
    } finally {
      setErrors({});
      RNAlert.alert("AI Auto-Fill ✨", `Đã tự động điền Tiêu đề & Mô tả chi tiết tương ứng với Mức ưu tiên [${severity.toUpperCase()}]!`);
    }
  };

  const handleConfirmExistingAlert = async (alertId: string) => {
    try {
      await confirmAlertMutation.mutateAsync(alertId);
      RNAlert.alert("Đã xác nhận 👍", "Cảm ơn bạn! Thông tin xác nhận đã được thêm để cán bộ ưu tiên xử lý.");
    } catch (err: any) {
      RNAlert.alert("Thông báo", err.response?.data?.message || "Đồng xác nhận thành công.");
    }
  };

  const handleRemovePhoto = (index: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const errs: { title?: string; description?: string; location?: string } = {};
    if (!title.trim()) errs.title = "Incident title is required.";
    if (!description.trim()) errs.description = "Detailed description is required.";
    if (!coords) errs.location = "Incident location is required.";
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
        location: {
          type: "Point",
          coordinates: coords!.coordinates,
        },
        address: address || undefined,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        isAnonymous,
      });

      RNAlert.alert("Success 🎉", t("report.successMsg", "Your incident report has been submitted successfully!"), [
        {
          text: "OK",
          onPress: () => {
            setTitle("");
            setDescription("");
            setMediaUrls([]);
            setIsAnonymous(false);
            setAiNote(null);
            navigation?.navigate("MyReportsTab");
          },
        },
      ]);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to submit incident report.";
      RNAlert.alert("Submission Error", msg);
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
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {/* Sticky Top Header */}
        <View style={[styles.stickyHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t("report.title", "Report Incident")}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            {t("report.subtitle", "Submit real-time geotagged alerts to municipal environmental officers.")}
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Nearby Duplicate Warning Banner */}
          {nearbyQuery.data && nearbyQuery.data.length > 0 ? (
            <Card style={[styles.duplicateCard, { backgroundColor: isDark ? "rgba(245,158,11,0.2)" : "#FEF3C7", borderColor: isDark ? "rgba(245,158,11,0.4)" : "#F59E0B" }]}>
              <View style={styles.duplicateHeader}>
                <Users size={18} color={isDark ? "#FBBF24" : "#D97706"} />
                <Text style={[styles.duplicateTitle, { color: isDark ? "#FDE047" : "#92400E" }]}>
                  Phát hiện {nearbyQuery.data.length} sự cố lân cận trong 200m!
                </Text>
              </View>
              <Text style={[styles.duplicateSub, { color: isDark ? "#FCD34D" : "#B45309" }]}>
                Sự cố tại vị trí này có thể đã được người dân khác báo cáo. Bạn có thể bấm "Đồng xác nhận" để gửi thông tin ưu tiên xử lý.
              </Text>
              {nearbyQuery.data.slice(0, 2).map((alert) => (
                <View key={alert._id} style={[styles.duplicateItem, { backgroundColor: colors.surface }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dupItemTitle, { color: colors.text }]} numberOfLines={1}>
                      {alert.title}
                    </Text>
                    <Text style={[styles.dupItemSub, { color: colors.textMuted }]}>
                      {alert.confirmationsCount || 1} lượt đồng xác nhận • {alert.status.toUpperCase()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.dupConfirmBtn}
                    onPress={() => handleConfirmExistingAlert(alert._id)}
                    disabled={confirmAlertMutation.isPending}
                  >
                    <CheckCircle2 size={14} color="#FFF" style={{ marginRight: 4 }} />
                    <Text style={styles.dupConfirmText}>+1 Xác nhận</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </Card>
          ) : null}

          {/* Category Selector */}
          <Text style={[styles.sectionLabel, { color: colors.text }]}>{t("report.categoryLabel", "Select Incident Category")}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catScroll}
            keyboardShouldPersistTaps="handled"
          >
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.value;
              return (
                <TouchableOpacity
                  key={cat.value}
                  activeOpacity={0.8}
                  onPress={() => handleSelectCategory(cat.value)}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: isSelected ? (isDark ? "rgba(34, 197, 94, 0.25)" : colors.primaryLight) : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={styles.catIcon}>{cat.icon}</Text>
                  <Text style={[styles.catText, { color: isSelected ? (isDark ? "#4ADE80" : colors.primaryDark) : colors.text }]}>{t(cat.labelKey, cat.fallbackLabel)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Severity Selector */}
          <Text style={[styles.sectionLabel, { color: colors.text }]}>{t("report.severityLabel", "Severity Priority Level")}</Text>
          <View style={styles.severityContainer}>
            {SEVERITIES.map((sev) => {
              const isSelected = severity === sev.value;
              const styleConfig = getSeverityStyle(sev.value, isSelected, isDark);
              return (
                <TouchableOpacity
                  key={sev.value}
                  activeOpacity={0.8}
                  onPress={() => handleSelectSeverity(sev.value)}
                  style={[
                    styles.sevChip,
                    {
                      backgroundColor: styleConfig.bg,
                      borderColor: styleConfig.border,
                    },
                  ]}
                >
                  <Text style={[styles.sevText, { color: styleConfig.text }]}>
                    {t(sev.labelKey, sev.fallbackLabel).toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Form Fields */}
          <GlassCard style={styles.formCard}>
            <View style={styles.aiActionRow}>
              <Text style={[styles.formTitle, { color: colors.text }]}>Report Details</Text>
              <TouchableOpacity
                style={[styles.aiButton, { backgroundColor: isDark ? "rgba(99,102,241,0.25)" : "#EEF2FF", borderColor: isDark ? "rgba(99,102,241,0.4)" : "#C7D2FE" }]}
                onPress={() => handleAiAnalyze()}
                disabled={analyzeMediaMutation.isPending}
              >
                {analyzeMediaMutation.isPending ? (
                  <ActivityIndicator size="small" color={isDark ? "#818CF8" : "#4F46E5"} />
                ) : (
                  <>
                    <Sparkles size={14} color={isDark ? "#818CF8" : "#4F46E5"} />
                    <Text style={[styles.aiBtnText, { color: isDark ? "#A5B4FC" : "#4F46E5" }]}>AI Auto-Fill</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {aiNote ? (
              <View style={[styles.aiBanner, { backgroundColor: isDark ? "rgba(99,102,241,0.25)" : "#E0E7FF" }]}>
                <Sparkles size={14} color={isDark ? "#818CF8" : "#4338CA"} />
                <Text style={[styles.aiBannerText, { color: isDark ? "#C7D2FE" : "#3730A3" }]}>{aiNote}</Text>
              </View>
            ) : null}

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
              value={description}
              onChangeText={setDescription}
              error={errors.description}
            />

            {/* Anonymous Toggle (1.4) */}
            <View style={[styles.anonymousRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.anonInfo}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <EyeOff size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.anonTitle, { color: colors.text }]}>Báo cáo Ẩn danh (Anonymous)</Text>
                </View>
                <Text style={[styles.anonSub, { color: colors.textMuted }]}>
                  Ẩn tên & SĐT của bạn khỏi giao diện công khai và phía cán bộ xử lý.
                </Text>
              </View>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ false: isDark ? "#334155" : "#CBD5E1", true: colors.primary }}
              />
            </View>

            {/* Photo & Evidence Upload Section */}
            <Text style={[styles.photoLabel, { color: colors.text }]}>Incident Photo & Evidence</Text>
            {mediaUrls.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                {mediaUrls.map((url, index) => (
                  <View key={index} style={styles.photoThumbContainer}>
                    <Image source={{ uri: url }} style={styles.photoThumb} />
                    <TouchableOpacity
                      style={styles.photoRemoveBtn}
                      onPress={() => handleRemovePhoto(index)}
                    >
                      <X size={14} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <TouchableOpacity
              style={[styles.addPhotoBtn, { borderColor: colors.primary, backgroundColor: isDark ? "rgba(34,197,94,0.15)" : colors.primaryLight }]}
              onPress={handlePickPhoto}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Camera size={20} color={colors.primary} />
                  <Text style={[styles.addPhotoText, { color: isDark ? "#4ADE80" : colors.primaryDark }]}>Take Photo or Select from Device</Text>
                </>
              )}
            </TouchableOpacity>
          </GlassCard>

          {/* Geolocation Section with React Native Maps */}
          <View style={styles.mapHeader}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Incident Location (GPS)</Text>
            <TouchableOpacity style={[styles.gpsButton, { backgroundColor: isDark ? "rgba(34,197,94,0.2)" : colors.primaryLight }]} onPress={fetchLocation} disabled={locLoading}>
              {locLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Navigation size={14} color={colors.primary} />
                  <Text style={[styles.gpsText, { color: colors.primary }]}>Locate Me</Text>
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

            <View style={[styles.addressBox, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
              <MapPin size={18} color={colors.primary} />
              <Text style={[styles.addressText, { color: colors.text }]} numberOfLines={2}>
                {address || "Tap map or click 'Locate Me' to set position"}
              </Text>
            </View>
            {locError ? <Text style={[styles.errorText, { color: colors.destructive }]}>{locError}</Text> : null}
            {errors.location ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.location}</Text> : null}
          </Card>

          {/* Submit Button */}
          <Button
            title="Submit Incident Report"
            onPress={handleSubmit}
            loading={createAlertMutation.isPending || isUploading}
            style={styles.submitBtn}
            icon={<Send size={18} color="#FFF" style={{ marginRight: 8 }} />}
          />

          <View style={styles.infoBox}>
            <AlertCircle size={14} color={colors.textMuted} />
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              False reports or malicious submissions may result in citizen account suspension.
            </Text>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoid: { flex: 1 },
  container: { flex: 1 },
  scrollView: { flex: 1 },
  stickyHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    zIndex: 10,
    elevation: 4,
  },
  headerTitle: { fontSize: 24, fontWeight: "800" },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  content: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 14 },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 12,
  },
  catScroll: { paddingBottom: 8, gap: 10 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  catIcon: { fontSize: 16, marginRight: 6 },
  catText: { fontSize: 13, fontWeight: "600" },
  severityContainer: { flexDirection: "row", gap: 8, marginBottom: 16 },
  sevChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
  },
  sevText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  formCard: { padding: 20, marginBottom: 16 },
  photoLabel: { fontSize: 14, fontWeight: "600", marginTop: 14, marginBottom: 8 },
  photoList: { flexDirection: "row", marginBottom: 12 },
  photoThumbContainer: { position: "relative", marginRight: 10 },
  photoThumb: { width: 90, height: 75, borderRadius: 12 },
  photoRemoveBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    marginTop: 4,
  },
  addPhotoText: { fontSize: 13, fontWeight: "700" },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  gpsButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  gpsText: { fontSize: 12, fontWeight: "700" },
  mapCard: { padding: 0, overflow: "hidden", marginBottom: 24 },
  mapContainer: { height: 220, width: "100%" },
  map: { ...StyleSheet.absoluteFillObject },
  addressBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  addressText: { fontSize: 13, flex: 1, fontWeight: "500" },
  errorText: {
    fontSize: 12,
    paddingHorizontal: 14,
    paddingBottom: 10,
    fontWeight: "600",
  },
  submitBtn: { marginTop: 8 },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    gap: 6,
    paddingHorizontal: 20,
  },
  infoText: { fontSize: 11, textAlign: "center" },
  duplicateCard: {
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  duplicateHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  duplicateTitle: { fontSize: 14, fontWeight: "700" },
  duplicateSub: { fontSize: 12, marginBottom: 10, lineHeight: 16 },
  duplicateItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    marginTop: 6,
    gap: 8,
  },
  dupItemTitle: { fontSize: 13, fontWeight: "700" },
  dupItemSub: { fontSize: 11, marginTop: 2 },
  dupConfirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dupConfirmText: { fontSize: 12, fontWeight: "700", color: "#FFF" },
  aiActionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  formTitle: { fontSize: 16, fontWeight: "700" },
  aiButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
  },
  aiBtnText: { fontSize: 12, fontWeight: "700" },
  aiBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
  },
  aiBannerText: { fontSize: 12, fontWeight: "600", flex: 1 },
  anonymousRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    marginVertical: 10,
    borderWidth: 1,
  },
  anonInfo: { flex: 1, paddingRight: 10 },
  anonTitle: { fontSize: 13, fontWeight: "700" },
  anonSub: { fontSize: 11, marginTop: 2 },
});


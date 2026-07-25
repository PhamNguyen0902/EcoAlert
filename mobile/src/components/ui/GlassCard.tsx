import React from "react";
import { StyleSheet, ViewProps, StyleProp, ViewStyle, Platform, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

interface GlassCardProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  intensity?: number;
  tint?: "light" | "dark" | "default";
  gradientColors?: readonly [string, string, ...string[]];
}

export const GlassCard: React.FC<GlassCardProps> = ({
  style,
  children,
  intensity = 50,
  tint = "light", // Chuyển mặc định sang 'light' để hiệu ứng kính đẹp hơn
  gradientColors,
  ...props
}) => {
  // Bảng màu gradient chuẩn cho hiệu ứng Glassmorphism (Kính mờ)
  const defaultColors: readonly [string, string, ...string[]] = gradientColors || [
    "rgba(255, 255, 255, 0.7)",
    "rgba(255, 255, 255, 0.3)",
  ];

  return (
    <View style={[styles.container, style]} {...props}>
      {/* 
        1. LỚP NỀN: Kính mờ (Chỉ bật trên iOS vì Android đôi khi xử lý hiệu ứng này gây lag/giật bàn phím)
        Sử dụng StyleSheet.absoluteFill để nó trải đều mà không đẩy cấu trúc của children
      */}
      {Platform.OS === "ios" && (
        <BlurView 
          intensity={intensity} 
          tint={tint} 
          style={StyleSheet.absoluteFill} 
        />
      )}

      {/* 2. LỚP PHỦ: Gradient tạo độ bóng và viền cho kính */}
      <LinearGradient
        colors={defaultColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* 
        3. LỚP NỘI DUNG: Form, Text, Input...
        Nằm ở một View riêng biệt với zIndex cao hơn để không bị ảnh hưởng khi render lại
      */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: "hidden", // Bắt buộc phải có để BlurView không bị tràn ra ngoài góc bo tròn
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    // Đổ bóng (Shadow) giúp thẻ kính nổi bật lên khỏi nền
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4, // Shadow dành cho Android
    backgroundColor: "rgba(255, 255, 255, 0.2)", // Màu nền dự phòng nếu Blur/Gradient chưa kịp load
  },
  content: {
    padding: 24, // Tăng padding lên một chút cho thoáng
    zIndex: 1,
  },
});
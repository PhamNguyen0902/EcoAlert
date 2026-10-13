import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLogout } from "./hooks/useAuth";
import { useCivicTheme } from "../shared/theme/useCivicTheme";

export const AdminMobileNoticeScreen = () => {
  const { colors } = useCivicTheme();
  const logout = useLogout();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>EcoAlert Mobile</Text>
        <Text style={[styles.message, { color: colors.textMuted }]}>
          Tài khoản quản trị chỉ sử dụng trên EcoAlert Web Dashboard
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đăng xuất tài khoản quản trị"
          disabled={logout.isPending}
          onPress={() => logout.mutate()}
          style={[styles.button, { backgroundColor: colors.primary }]}
        >
          {logout.isPending ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.background }]}>Đăng xuất</Text>
          )}
        </Pressable>
        {logout.isError ? (
          <Text style={[styles.error, { color: colors.warning }]}>
            Không thể đăng xuất. Vui lòng thử lại.
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 },
  card: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: "center", gap: 18 },
  title: { fontSize: 22, fontWeight: "700" },
  message: { fontSize: 16, lineHeight: 24, textAlign: "center" },
  button: { minHeight: 48, minWidth: 160, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  buttonText: { fontSize: 16, fontWeight: "700" },
  error: { fontSize: 13, textAlign: "center" },
});

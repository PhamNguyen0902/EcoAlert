import React, { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FieldReportDraft } from "../types";
import { useReportTheme } from "../useReportTheme";
import { ReportHeader } from "./ReportHeader";

export function ReportDraftRecovery({ drafts, hasRepairs, storageError, onResume, onNew, onRetry }: {
  drafts: FieldReportDraft[];
  hasRepairs: boolean;
  storageError: boolean;
  onResume: (id: string) => Promise<void>;
  onNew: () => Promise<void>;
  onRetry: () => void;
}) {
  const { colors } = useReportTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const choose = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(false);
    try { await action(); }
    catch (cause) { setError(true); if (__DEV__) console.error("[FieldReport] draft selection failed", cause); }
    finally { setBusy(false); }
  };
  return <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
    <ReportHeader title="Bản nháp báo cáo" onBack={navigation.goBack} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
      <Text style={[styles.title, { color: colors.text }]}>Bạn muốn tiếp tục hay tạo báo cáo mới?</Text>
      <Text style={{ color: colors.textMuted, lineHeight: 21 }}>Ảnh của bản nháp cũ không được tính vào báo cáo mới. Bản nháp chưa gửi vẫn được giữ trên thiết bị.</Text>
      {hasRepairs ? <Text style={{ color: colors.accent }} accessibilityRole="alert">Một phần dữ liệu cũ cần kiểm tra. Dữ liệu gốc đã được lưu dự phòng; danh sách dưới đây chỉ tính ảnh có thể khôi phục.</Text> : null}
      {drafts.map(draft => <View key={draft.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.draftTitle, { color: colors.text }]}>{draft.title.trim() || "Báo cáo chưa gửi"}</Text>
        <Text style={{ color: colors.textMuted }}>{draft.photos.length} ảnh đang giữ</Text>
        <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
          {draft.photos.map(photo => <Image key={photo.id} source={{ uri: photo.displayLocalUri || photo.originalLocalUri }} style={styles.thumbnail} />)}
        </ScrollView>
        <TouchableOpacity disabled={busy || storageError} onPress={() => void choose(() => onResume(draft.id))} accessibilityRole="button" style={[styles.button, { borderColor: colors.primary, borderWidth: 1 }]}>
          <Text style={{ color: colors.primary, fontWeight: "700" }}>TIẾP TỤC BẢN NHÁP</Text>
        </TouchableOpacity>
      </View>)}
      {storageError || error ? <Text style={{ color: colors.destructive }} accessibilityRole="alert">Chưa đọc/lưu được bản nháp. Vui lòng thử lại; dữ liệu cũ chưa bị xóa.</Text> : null}
      {storageError ? <TouchableOpacity onPress={onRetry} style={styles.button} accessibilityRole="button"><Text style={{ color: colors.primary }}>THỬ ĐỌC LẠI BẢN NHÁP</Text></TouchableOpacity> :
        <TouchableOpacity disabled={busy} onPress={() => void choose(onNew)} accessibilityRole="button" style={[styles.button, { backgroundColor: colors.primary }]}>
          <Text style={{ color: "#07101F", fontWeight: "800" }}>{busy ? "ĐANG LƯU…" : "TẠO BÁO CÁO MỚI · 0 ẢNH"}</Text>
        </TouchableOpacity>}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 }, title: { fontSize: 21, fontWeight: "800", lineHeight: 29 },
  card: { padding: 14, gap: 10, borderRadius: 14, borderWidth: 1 },
  draftTitle: { fontSize: 15, fontWeight: "700" }, thumbnail: { width: 60, height: 80, borderRadius: 8 },
  button: { minHeight: 48, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
});

import * as SecureStore from "expo-secure-store";
import type { AlertCategory, CaptureMetadata, ImageValidation, CreateAlertData } from "../../../shared/types/index";

export interface OfflineReportDraft {
  id: string;
  title: string;
  description: string;
  address?: string;
  location: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
 // giữ lại cho các bản nháp cũ được tạo trước khi tách riêng bằng chứng chụp hiện trường
  localMediaUris: string[];
  originalLocalUri?: string;
  displayLocalUri?: string;
  // trường tùy chọn để các bản nháp từ phiên bản ứng dụng cũ vẫn có thể đồng bộ bình thường
  captureMetadata?: CaptureMetadata;
  imageValidation?: ImageValidation;
  category?: AlertCategory;
  classification?: CreateAlertData["classification"];
  isAnonymous?: boolean;
  createdAt: string;
}

const OFFLINE_QUEUE_KEY = "ecoalert_offline_incident_drafts_v1";

export const offlineQueue = {
  // lấy toàn bộ danh sách bản nháp báo cáo ngoại tuyến từ bộ nhớ bảo mật
  getOfflineDrafts: async (): Promise<OfflineReportDraft[]> => {
    try {
      const data = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
      if (!data) return [];
      return JSON.parse(data) as OfflineReportDraft[];
    } catch (e) {
      console.error("[OfflineQueue] Error reading offline drafts:", e);
      return [];
    }
  },

  // lưu bản nháp báo cáo mới vào hàng đợi ngoại tuyến
  saveOfflineDraft: async (
    draftInput: Omit<OfflineReportDraft, "id" | "createdAt">,
  ): Promise<OfflineReportDraft> => {
    const existing = await offlineQueue.getOfflineDrafts();
    const newDraft: OfflineReportDraft = {
      ...draftInput,
      id: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [newDraft, ...existing];
    await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
    console.log("[OfflineQueue] Saved offline draft:", newDraft.id);
    return newDraft;
  },

 // xóa một bản nháp cụ thể khỏi hàng đợi sau khi đã tải lên thành công
  removeOfflineDraft: async (id: string): Promise<void> => {
    const existing = await offlineQueue.getOfflineDrafts();
    const updated = existing.filter((item) => item.id !== id);
    await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
    console.log("[OfflineQueue] Removed draft:", id);
  },

  // xóa sạch toàn bộ bản nháp trong hàng đợi ngoại tuyến
  clearOfflineDrafts: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(OFFLINE_QUEUE_KEY);
    console.log("[OfflineQueue] Cleared offline queue.");
  },
};

import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";
import type { AlertCategory, CaptureMetadata, ImageValidation, CreateAlertData } from "../../shared/types";
import type { FieldReportCaptureDraft } from "./types";
import { storage } from "../../shared/utils/storage";

export interface OfflineReportDraft {
  id: string;
  clientReportId?: string;
  ownerId?: string;
  photos?: FieldReportCaptureDraft[];
  primaryPhotoId?: string;
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
const queueFile = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}field-offline-queue.json` : null;
const writeQueue = async (drafts: OfflineReportDraft[]) => {
  if (!queueFile) throw new Error("Persistent queue storage is unavailable");
  await FileSystem.writeAsStringAsync(queueFile, JSON.stringify(drafts));
};

export const offlineQueue = {
  // lấy toàn bộ danh sách bản nháp báo cáo ngoại tuyến từ bộ nhớ bảo mật
  getOfflineDrafts: async (): Promise<OfflineReportDraft[]> => {
    try {
      const data = queueFile && await FileSystem.getInfoAsync(queueFile).then(info => info.exists)
        ? await FileSystem.readAsStringAsync(queueFile)
        : await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);
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
    const ownerId = draftInput.ownerId || (await storage.getUser())?._id;
    if (draftInput.clientReportId && !ownerId) throw new Error("Cannot queue a field report without an authenticated owner");
    const prior = existing.find(item => draftInput.clientReportId && item.clientReportId === draftInput.clientReportId && item.ownerId === ownerId);
    if (prior) return prior;
    const newDraft: OfflineReportDraft = {
      ...draftInput,
      ownerId,
      id: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [newDraft, ...existing];
    await writeQueue(updated);
    console.log("[OfflineQueue] Saved offline draft:", newDraft.id);
    return newDraft;
  },

  updateOfflineDraft: async (id: string, patch: Partial<OfflineReportDraft>): Promise<void> => {
    const existing = await offlineQueue.getOfflineDrafts();
    await writeQueue(existing.map(item =>
      item.id === id ? { ...item, ...patch } : item));
  },

 // xóa một bản nháp cụ thể khỏi hàng đợi sau khi đã tải lên thành công
  removeOfflineDraft: async (id: string): Promise<void> => {
    const existing = await offlineQueue.getOfflineDrafts();
    const updated = existing.filter((item) => item.id !== id);
    await writeQueue(updated);
    console.log("[OfflineQueue] Removed draft:", id);
  },

  // xóa sạch toàn bộ bản nháp trong hàng đợi ngoại tuyến
  clearOfflineDrafts: async (): Promise<void> => {
    await writeQueue([]);
    await SecureStore.deleteItemAsync(OFFLINE_QUEUE_KEY);
    console.log("[OfflineQueue] Cleared offline queue.");
  },
};

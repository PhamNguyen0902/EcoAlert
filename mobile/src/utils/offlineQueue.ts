import * as SecureStore from "expo-secure-store";

export interface OfflineReportDraft {
  id: string;
  title: string;
  description: string;
  address?: string;
  location: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  localMediaUris: string[];
  isAnonymous?: boolean;
  createdAt: string;
}

const OFFLINE_QUEUE_KEY = "ecoalert_offline_incident_drafts_v1";

export const offlineQueue = {
  /**
   * Retrieves all saved offline report drafts from secure storage
   */
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

  /**
   * Saves a new report draft to the offline queue
   */
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

  /**
   * Removes a specific draft from the queue after successful upload
   */
  removeOfflineDraft: async (id: string): Promise<void> => {
    const existing = await offlineQueue.getOfflineDrafts();
    const updated = existing.filter((item) => item.id !== id);
    await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
    console.log("[OfflineQueue] Removed draft:", id);
  },

  /**
   * Clears all offline drafts
   */
  clearOfflineDrafts: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(OFFLINE_QUEUE_KEY);
    console.log("[OfflineQueue] Cleared offline queue.");
  },
};

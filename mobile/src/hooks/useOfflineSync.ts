import { useCallback, useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { offlineQueue, OfflineReportDraft } from "../utils/offlineQueue";
import { alertService } from "../api/alertService";

export function useOfflineSync() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [offlineDrafts, setOfflineDrafts] = useState<OfflineReportDraft[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const queryClient = useQueryClient();

  const loadDrafts = useCallback(async () => {
    const drafts = await offlineQueue.getOfflineDrafts();
    setOfflineDrafts(drafts);
  }, []);

  // Synchronize drafts with backend
  const syncOfflineDrafts = useCallback(async () => {
    const currentDrafts = await offlineQueue.getOfflineDrafts();
    if (currentDrafts.length === 0) return { successCount: 0, errorCount: 0 };

    setIsSyncing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const draft of currentDrafts) {
      try {
        // Upload media files first if any
        const uploadedMediaUrls: string[] = [];
        for (const localUri of draft.localMediaUris) {
          if (localUri.startsWith("http://") || localUri.startsWith("https://")) {
            uploadedMediaUrls.push(localUri);
          } else {
            const fileName = `offline_${Date.now()}.jpg`;
            const uploadedUrl = await alertService.uploadMedia(localUri, fileName, "image/jpeg");
            if (uploadedUrl) {
              uploadedMediaUrls.push(uploadedUrl);
            }
          }
        }

        // Submit alert to backend
        await alertService.createAlert({
          title: draft.title,
          description: draft.description,
          address: draft.address,
          location: draft.location,
          mediaUrls: uploadedMediaUrls,
          isAnonymous: draft.isAnonymous,
        });

        // Remove successfully synced draft from offline storage
        await offlineQueue.removeOfflineDraft(draft.id);
        successCount++;
      } catch (err) {
        console.error(`[OfflineSync] Failed to sync draft ${draft.id}:`, err);
        errorCount++;
      }
    }

    await loadDrafts();
    setIsSyncing(false);

    if (successCount > 0) {
      queryClient.invalidateQueries();
    }

    return { successCount, errorCount };
  }, [loadDrafts, queryClient]);

  // Subscribe to network changes
  useEffect(() => {
    void loadDrafts();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsConnected(online);

      // Auto-sync when coming back online
      if (online && !isSyncing) {
        void syncOfflineDrafts();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isSyncing, loadDrafts, syncOfflineDrafts]);

  return {
    isConnected,
    isOffline: isConnected === false,
    offlineDrafts,
    offlineCount: offlineDrafts.length,
    isSyncing,
    syncOfflineDrafts,
    refetchDrafts: loadDrafts,
  };
}

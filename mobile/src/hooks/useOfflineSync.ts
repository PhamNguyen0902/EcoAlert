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
        // Legacy drafts only have localMediaUris. Field-capture drafts preserve
        // the original/display relationship explicitly so AI still uses original.
        const originalLocalUri = draft.originalLocalUri || draft.localMediaUris[0];
        if (!originalLocalUri) throw new Error("Offline draft has no original evidence image");

        const uploadLocalImage = async (localUri: string, fileName: string): Promise<string> => {
          if (localUri.startsWith("http://") || localUri.startsWith("https://")) {
            return localUri;
          }
          return alertService.uploadMedia(localUri, fileName, "image/jpeg");
        };

        const originalUploadedUrl = await uploadLocalImage(
          originalLocalUri,
          `offline_original_${draft.id}.jpg`,
        );
        let displayUploadedUrl: string | undefined;
        if (draft.displayLocalUri) {
          try {
            displayUploadedUrl = await uploadLocalImage(draft.displayLocalUri, `offline_display_${draft.id}.jpg`);
          } catch (displayError) {
            // Original evidence remains sufficient for AI/report creation.
            console.warn(`[OfflineSync] Display evidence upload failed for ${draft.id}:`, displayError);
          }
        }

        const uploadedMediaUrls = draft.originalLocalUri
          ? [originalUploadedUrl]
          : [
              originalUploadedUrl,
              ...await Promise.all(draft.localMediaUris.slice(1).map((localUri, index) =>
                uploadLocalImage(localUri, `offline_${draft.id}_${index + 1}.jpg`),
              )),
            ];
        // Submit alert to backend
        await alertService.createAlert({
          title: draft.title,
          description: draft.description,
          address: draft.address,
          location: draft.location,
          mediaUrls: uploadedMediaUrls,
          captureMetadata: draft.captureMetadata,
          fieldEvidence: draft.originalLocalUri && draft.captureMetadata
            ? [{
                originalUrl: originalUploadedUrl,
                ...(displayUploadedUrl ? { displayUrl: displayUploadedUrl } : {}),
                capturedAt: draft.captureMetadata.capturedAt,
                gpsAccuracyMeters: draft.captureMetadata.gpsAccuracyMeters,
              }]
            : undefined,
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

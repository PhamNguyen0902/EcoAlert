import { useCallback, useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { useQueryClient } from "@tanstack/react-query";
import { offlineQueue, OfflineReportDraft } from "../offlineQueue";
import { alertService } from "../../../shared/api/alertService";
import type { FieldReportCaptureDraft } from "../types";
import { storage } from "../../../shared/utils/storage";

let syncInProgress = false;

// hook quản lý trạng thái kết nối mạng và quy trình đồng bộ dữ liệu ngoại tuyến
export function useOfflineSync() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [offlineDrafts, setOfflineDrafts] = useState<OfflineReportDraft[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const queryClient = useQueryClient();

  // nạp danh sách bản nháp từ bộ nhớ bảo mật vào trạng thái ứng dụng
  const loadDrafts = useCallback(async () => {
    const drafts = await offlineQueue.getOfflineDrafts();
    const ownerId = (await storage.getUser())?._id;
    setOfflineDrafts(drafts.filter(item => item.clientReportId ? item.ownerId === ownerId : !item.ownerId || item.ownerId === ownerId));
  }, []);

  // đồng bộ các bản nháp ngoại tuyến lên máy chủ qua api tạo báo cáo
  const syncOfflineDrafts = useCallback(async () => {
    if (syncInProgress) return { successCount: 0, errorCount: 0 };
    const currentDrafts = await offlineQueue.getOfflineDrafts();
    const ownerId = (await storage.getUser())?._id;
    if (!ownerId) return { successCount: 0, errorCount: 0 };
    if (currentDrafts.length === 0) return { successCount: 0, errorCount: 0 };

    syncInProgress = true;
    setIsSyncing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const draft of currentDrafts) {
      if (draft.clientReportId ? draft.ownerId !== ownerId : draft.ownerId && draft.ownerId !== ownerId) continue;
      try {
        const photos: FieldReportCaptureDraft[] = draft.photos?.length ? [...draft.photos] :
          draft.localMediaUris.map((uri, index) => ({
            id: `legacy_${index}`, originalLocalUri: uri, capturedAt: draft.captureMetadata?.capturedAt || draft.createdAt,
            ...(index === 0 && draft.displayLocalUri ? { displayLocalUri: draft.displayLocalUri } : {}),
          }));
        if (!photos.length) throw new Error("Offline draft has no evidence image");

        // tải ảnh cục bộ lên máy chủ nếu đường dẫn chưa phải là liên kết mạng
        const uploadLocalImage = async (localUri: string, fileName: string, idempotencyKey: string): Promise<{ url: string; ownershipProof?: string }> => {
          if (localUri.startsWith("http://") || localUri.startsWith("https://")) {
            return { url: localUri };
          }
          return alertService.uploadFieldMedia(localUri, fileName, "image/jpeg", idempotencyKey);
        };

        const uploaded = [];
        for (let index = 0; index < photos.length; index++) {
          const photo = photos[index];
          const originalUpload = photo.originalUploadedUrl && (photo.originalOwnershipProof || !draft.clientReportId)
            ? { url: photo.originalUploadedUrl, ownershipProof: photo.originalOwnershipProof }
            : await uploadLocalImage(photo.originalLocalUri, `offline_${draft.id}_${photo.id || index}.jpg`, `${draft.clientReportId || draft.id}:${photo.id || index}:original`);
          const originalUploadedUrl = originalUpload.url;
          let displayUploadedUrl = photo.displayUploadedUrl;
          let displayOwnershipProof = photo.displayOwnershipProof;
          if (photo.displayLocalUri && (!displayUploadedUrl || (draft.clientReportId && !displayOwnershipProof))) {
            try { const displayUpload = await uploadLocalImage(photo.displayLocalUri, `offline_display_${draft.id}_${photo.id || index}.jpg`, `${draft.clientReportId || draft.id}:${photo.id || index}:display`);
              displayUploadedUrl = displayUpload.url; displayOwnershipProof = displayUpload.ownershipProof; }
            catch (displayError) { console.warn(`[OfflineSync] Display upload failed for ${draft.id}:`, displayError); }
          }
          if (draft.clientReportId && displayUploadedUrl && !displayOwnershipProof) displayUploadedUrl = undefined;
          photos[index] = { ...photo, originalUploadedUrl, originalOwnershipProof: originalUpload.ownershipProof,
            displayUploadedUrl, displayOwnershipProof, uploadState: "UPLOADED" };
          await offlineQueue.updateOfflineDraft(draft.id, { photos });
          uploaded.push({ photo: photos[index], originalUploadedUrl, originalOwnershipProof: originalUpload.ownershipProof, displayUploadedUrl, displayOwnershipProof });
        }

        // gửi dữ liệu báo cáo lên máy chủ
        await alertService.createAlert({
          clientReportId: draft.clientReportId,
          title: draft.title,
          description: draft.description,
          address: draft.address,
          location: draft.location,
          mediaUrls: uploaded.map(item => item.originalUploadedUrl),
          captureMetadata: draft.captureMetadata,
          imageValidation: draft.imageValidation,
          category: draft.category,
          classification: draft.classification,
          fieldEvidence: draft.captureMetadata ? uploaded.map(({ photo, originalUploadedUrl, originalOwnershipProof, displayUploadedUrl, displayOwnershipProof }) => ({
            photoId: photo.id, isPrimary: photo.id === (draft.primaryPhotoId || photos[0]?.id),
            originalUrl: originalUploadedUrl,
            originalOwnershipProof,
            ...(displayUploadedUrl ? { displayUrl: displayUploadedUrl, displayOwnershipProof } : {}),
            capturedAt: photo.capturedAt,
            gpsAccuracyMeters: photo.location?.accuracyMeters ?? draft.captureMetadata!.gpsAccuracyMeters,
            gpsCapturedAt: photo.location?.capturedAt,
            latitude: photo.location?.latitude, longitude: photo.location?.longitude,
            width: photo.width, height: photo.height,
          })) : undefined,
          isAnonymous: draft.isAnonymous,
        });

        // xóa bản nháp đã đồng bộ thành công khỏi bộ nhớ ngoại tuyến
        await offlineQueue.removeOfflineDraft(draft.id);
        successCount++;
      } catch (err) {
        console.error(`[OfflineSync] Failed to sync draft ${draft.id}:`, err);
        errorCount++;
      }
    }

    await loadDrafts();
    setIsSyncing(false);
    syncInProgress = false;

    if (successCount > 0) {
      queryClient.invalidateQueries();
    }

    return { successCount, errorCount };
  }, [loadDrafts, queryClient]);

  // lắng nghe sự thay đổi trạng thái kết nối mạng
  useEffect(() => {
    void loadDrafts();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsConnected(online);

      // tự động đồng bộ khi thiết bị có kết nối mạng trở lại
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

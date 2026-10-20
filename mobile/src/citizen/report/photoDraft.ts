import { MAX_FIELD_REPORT_PHOTOS, type FieldReportCaptureDraft, type FieldReportDraft } from "./types";

export function normalizePhotoDraft(draft: FieldReportDraft): FieldReportDraft {
  // An explicit empty array means the last photo was deleted. Only absent photos
  // may migrate from capture; never resurrect the legacy alias after deletion.
  const photos = Array.isArray(draft.photos) ? draft.photos : draft.capture ? [draft.capture] : [];
  const seenUris = new Set<string>();
  const seenIds = new Set<string>();
  const normalized: FieldReportCaptureDraft[] = [];
  photos.forEach((photo, index) => {
    if (!photo || typeof photo.originalLocalUri !== "string" ||
        !/^(file|content|https?):\/\/.+/.test(photo.originalLocalUri.trim()) ||
        typeof photo.capturedAt !== "string" || !Number.isFinite(Date.parse(photo.capturedAt))) return;
    const uri = photo.originalLocalUri.trim();
    if (seenUris.has(uri)) return;
    seenUris.add(uri);
    let id = typeof photo.id === "string" && photo.id.trim() ? photo.id : `legacy_${index}_${photo.capturedAt.replace(/[^0-9]/g, "")}`;
    if (seenIds.has(id)) id = `${id}_recovered_${index}`;
    while (seenIds.has(id)) id += "_r";
    seenIds.add(id);
    normalized.push({ ...photo, id, originalLocalUri: uri,
      location: photo.location || (photos.length === 1 ? draft.location : undefined) });
  });
  const primaryPhotoId = normalized.some((photo) => photo.id === draft.primaryPhotoId)
    ? draft.primaryPhotoId : normalized[0]?.id;
  const capture = normalized.find((photo) => photo.id === primaryPhotoId);
  return { ...draft, id: draft.id || `field_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    photos: normalized, primaryPhotoId, capture, location: capture?.location || draft.location };
}

export function addPhoto(draft: FieldReportDraft, photo: FieldReportCaptureDraft): FieldReportDraft {
  const current = normalizePhotoDraft(draft);
  if (current.photos.some(item => (photo.id && item.id === photo.id) || item.originalLocalUri === photo.originalLocalUri)) return current;
  if (!normalizePhotoDraft({ ...current, photos: [photo] }).photos.length) throw new Error("INVALID_PHOTO");
  if (current.photos.length >= MAX_FIELD_REPORT_PHOTOS) throw new Error("PHOTO_LIMIT");
  const id = photo.id || `photo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const photos = [...current.photos, { ...photo, id }];
  const primaryPhotoId = id;
  const capture = photos.find((item) => item.id === primaryPhotoId);
  return { ...current, photos, primaryPhotoId, capture, location: capture?.location || current.location,
    imageValidation: { state: "IDLE", detectedObjects: [] } };
}

export function selectPrimaryPhoto(draft: FieldReportDraft, id: string): FieldReportDraft {
  const current = normalizePhotoDraft(draft);
  const capture = current.photos.find((photo) => photo.id === id);
  return capture ? { ...current, primaryPhotoId: id, capture, location: capture.location || current.location,
    imageValidation: current.primaryPhotoId === id ? current.imageValidation : capture.analysis || { state: "IDLE", detectedObjects: [] } } : current;
}

export function removePhoto(draft: FieldReportDraft, id: string): FieldReportDraft {
  const current = normalizePhotoDraft(draft);
  const photos = current.photos.filter((photo) => photo.id !== id);
  const primaryPhotoId = current.primaryPhotoId === id ? photos[0]?.id : current.primaryPhotoId;
  const capture = photos.find((photo) => photo.id === primaryPhotoId);
  return { ...current, photos, primaryPhotoId, capture, location: capture?.location || current.location,
    imageValidation: { state: "IDLE", detectedObjects: [] } };
}

export function updatePhoto(draft: FieldReportDraft, id: string, patch: Partial<FieldReportCaptureDraft>): FieldReportDraft {
  const current = normalizePhotoDraft(draft);
  const photos = current.photos.map((photo) => photo.id === id ? { ...photo, ...patch } : photo);
  return { ...current, photos, capture: photos.find((photo) => photo.id === current.primaryPhotoId) };
}

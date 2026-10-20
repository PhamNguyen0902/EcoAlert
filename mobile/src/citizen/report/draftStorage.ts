import * as FileSystem from "expo-file-system/legacy";
import { createEmptyFieldReportDraft, type FieldReportDraft } from "./types";
import { normalizePhotoDraft } from "./photoDraft";

export interface FieldDraftCollection {
  version: 2;
  active: FieldReportDraft;
  savedDrafts: FieldReportDraft[];
}
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function hasUnsentContent(draft: FieldReportDraft): boolean {
  return !draft.createdAlert && !draft.completedAt && Boolean(draft.photos.length || draft.title.trim() || draft.description.trim());
}
export function keepSavedDraft(drafts: FieldReportDraft[], draft: FieldReportDraft): FieldReportDraft[] {
  if (!hasUnsentContent(draft)) return drafts;
  return [draft, ...drafts.filter(item => item.id !== draft.id)];
}

/** Accept the old single-draft JSON, keeping the original bytes backed up before repair. */
export function decodeDraftCollection(raw: string) {
  const issues: string[] = [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { issues.push("INVALID_JSON"); }
  const repair = (value: unknown): FieldReportDraft => {
    const empty = createEmptyFieldReportDraft();
    if (!isRecord(value)) { issues.push("INVALID_DRAFT"); return empty; }
    const candidate = { ...empty, ...value,
      id: typeof value.id === "string" && value.id ? value.id : empty.id,
      title: typeof value.title === "string" ? value.title : "",
      description: typeof value.description === "string" ? value.description : "",
      imageValidation: isRecord(value.imageValidation) && Array.isArray(value.imageValidation.detectedObjects)
        ? value.imageValidation : empty.imageValidation,
      // Preserve absent photos for legacy migration, but a malformed array is not a photo.
      photos: value.photos === undefined ? undefined : Array.isArray(value.photos) ? value.photos : [],
    } as FieldReportDraft;
    const draft = normalizePhotoDraft(candidate);
    if (Array.isArray(value.photos) && value.photos.length !== draft.photos.length) issues.push("INVALID_OR_DUPLICATE_PHOTOS");
    if (value.photos !== undefined && !Array.isArray(value.photos)) issues.push("INVALID_PHOTOS_ARRAY");
    return draft;
  };
  const envelope = isRecord(parsed) && parsed.version === 2 ? parsed : null;
  const active = repair(envelope ? envelope.active : parsed);
  let savedDrafts: FieldReportDraft[] = [];
  if (envelope && Array.isArray(envelope.savedDrafts)) {
    for (const item of envelope.savedDrafts) savedDrafts = keepSavedDraft(savedDrafts, repair(item));
  }
  const collection: FieldDraftCollection = { version: 2, active, savedDrafts };
  return { collection, issues, needsBackup: !envelope || issues.length > 0 };
}

export async function loadDraftCollection(fileUri: string) {
  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists) return { collection: { version: 2 as const, active: createEmptyFieldReportDraft(), savedDrafts: [] }, issues: [] };
  const raw = await FileSystem.readAsStringAsync(fileUri);
  const result = decodeDraftCollection(raw);
  // A URI from an old camera cache can be syntactically valid but no longer exist.
  for (const draft of [result.collection.active, ...result.collection.savedDrafts]) {
    const kept = [];
    for (const photo of draft.photos) {
      if (photo.originalLocalUri.startsWith("file://")) {
        try {
          if (!(await FileSystem.getInfoAsync(photo.originalLocalUri)).exists) {
            result.issues.push("MISSING_LOCAL_IMAGE");
            continue;
          }
        } catch { /* Unknown access is not evidence that an image should be removed. */ }
      }
      kept.push(photo);
    }
    Object.assign(draft, normalizePhotoDraft({ ...draft, photos: kept }));
  }
  if (result.needsBackup || result.issues.length) {
    await FileSystem.writeAsStringAsync(`${fileUri}.recovery-${Date.now()}.json`, raw);
  }
  return result;
}

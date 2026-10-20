import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useEffect,
  useState,
  useRef,
} from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import * as FileSystem from "expo-file-system/legacy";
import { useProfile } from "../../auth/hooks/useAuth";
import { createEmptyFieldReportDraft, type FieldReportDraft } from "./types";
import { keepSavedDraft, loadDraftCollection } from "./draftStorage";
import { ReportDraftRecovery } from "./components/ReportDraftRecovery";

interface FieldReportContextValue {
  draft: FieldReportDraft;
  setDraft: Dispatch<SetStateAction<FieldReportDraft>>;
  saveDraftNow: (update: SetStateAction<FieldReportDraft>) => Promise<void>;
  resetDraft: () => Promise<void>;
  completeDraft: (expectedId?: string) => Promise<void>;
  openSavedDrafts: () => void;
  savedDraftCount: number;
}

const FieldReportContext = createContext<FieldReportContextValue | null>(null);
// khởi tạo nhà cung cấp ngữ cảnh lưu trữ bản nháp báo cáo hiện trường
export const FieldReportProvider = ({ children }: { children: ReactNode }) => {
  const { data: profile } = useProfile();
  const fileUri = FileSystem.documentDirectory && profile?._id
    ? `${FileSystem.documentDirectory}field-draft-${profile._id}.json` : null;
  const [hydrated, setHydrated] = useState(false);
  const [draft, writeState] = useState<FieldReportDraft>(
    createEmptyFieldReportDraft,
  );
  const draftRef = useRef(draft);
  const revision = useRef(0);
  const savedDraftsRef = useRef<FieldReportDraft[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<FieldReportDraft[]>([]);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryIssues, setRecoveryIssues] = useState<string[]>([]);
  const [storageError, setStorageError] = useState(false);
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const pendingWrite = useRef<Promise<void>>(Promise.resolve());
  const setDraft = useCallback<Dispatch<SetStateAction<FieldReportDraft>>>((update) => {
    const next = typeof update === "function" ? update(draftRef.current) : update;
    revision.current += 1;
    draftRef.current = next;
    writeState(next);
  }, []);
  const persistDraft = useCallback((next: FieldReportDraft) => {
    const data = JSON.stringify({ version: 2, active: next, savedDrafts: savedDraftsRef.current });
    const write = pendingWrite.current.catch(() => undefined).then(async () => {
      if (fileUri) await FileSystem.writeAsStringAsync(fileUri, data);
    });
    pendingWrite.current = write;
    return write;
  }, [fileUri]);
  const saveDraftNow = useCallback(async (update: SetStateAction<FieldReportDraft>) => {
    const next = typeof update === "function" ? update(draftRef.current) : update;
    // Keep a captured photo recoverable in memory even if the JSON write fails.
    setDraft(next);
    await persistDraft(next);
  }, [persistDraft, setDraft]);
  useEffect(() => {
    let cancelled = false;
    const startingRevision = revision.current;
    setHydrated(false);
    setStorageError(false);
    void (async () => {
      if (fileUri) {
        try {
          await pendingWrite.current.catch(() => undefined);
          const stored = await loadDraftCollection(fileUri);
          if (cancelled) return;
          const candidates = keepSavedDraft(stored.collection.savedDrafts, stored.collection.active);
          savedDraftsRef.current = candidates;
          setSavedDrafts(candidates);
          setRecoveryIssues(stored.issues);
          if (__DEV__ && stored.issues.length) console.warn("[FieldReport] draft recovery", { reasons: stored.issues });
          // A reset/new session while storage is being read wins over late hydration.
          // Keep the old draft as a choice, never inject its photos into the new session.
          if (revision.current === startingRevision) setRecoveryOpen(candidates.length > 0 || stored.issues.length > 0);
        } catch (error) {
          if (cancelled) return;
          setStorageError(true);
          setRecoveryOpen(true);
          if (__DEV__) console.error("[FieldReport] draft hydration failed", error);
        }
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [fileUri, hydrationAttempt]);
  useEffect(() => {
    if (!hydrated || !fileUri || recoveryOpen || storageError) return;
    const timer = setTimeout(() => {
      void persistDraft(draftRef.current).catch((error) => {
        if (__DEV__) console.error("[FieldReport] Could not persist draft", error);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, fileUri, hydrated, persistDraft, recoveryOpen, storageError, savedDrafts]);
  // làm mới dữ liệu bản nháp về trạng thái khởi tạo ban đầu
  const resetDraft = useCallback(
    async () => {
      const saved = keepSavedDraft(savedDraftsRef.current, draftRef.current);
      savedDraftsRef.current = saved;
      setSavedDrafts(saved);
      const empty = createEmptyFieldReportDraft();
      setDraft(empty);
      await persistDraft(empty);
      setRecoveryOpen(false);
    },
    [persistDraft, setDraft],
  );
  const completeDraft = useCallback(async (expectedId?: string) => {
    if (expectedId && draftRef.current.id !== expectedId) throw new Error("DRAFT_CHANGED");
    const next = { ...draftRef.current, completedAt: new Date().toISOString() };
    savedDraftsRef.current = savedDraftsRef.current.filter(item => item.id !== next.id);
    setSavedDrafts(savedDraftsRef.current);
    setDraft(next);
    await persistDraft(next);
  }, [persistDraft, setDraft]);
  const resumeDraft = useCallback(async (id: string) => {
    const selected = savedDraftsRef.current.find(item => item.id === id);
    if (!selected) throw new Error("DRAFT_NOT_FOUND");
    const saved = keepSavedDraft(savedDraftsRef.current, draftRef.current).filter(item => item.id !== id);
    savedDraftsRef.current = saved;
    setSavedDrafts(saved);
    setDraft(selected);
    await persistDraft(selected);
    setRecoveryOpen(false);
  }, [persistDraft, setDraft]);
  const openSavedDrafts = useCallback(() => {
    const saved = keepSavedDraft(savedDraftsRef.current, draftRef.current);
    savedDraftsRef.current = saved;
    setSavedDrafts(saved);
    setRecoveryOpen(true);
  }, []);
  const value = useMemo(
    () => ({ draft, setDraft, saveDraftNow, resetDraft, completeDraft, openSavedDrafts, savedDraftCount: savedDrafts.length }),
    [draft, setDraft, saveDraftNow, resetDraft, completeDraft, openSavedDrafts, savedDrafts.length],
  );

  if (!hydrated) return null;
  return (
    <FieldReportContext.Provider value={value}>
      {recoveryOpen ? <ReportDraftRecovery drafts={savedDrafts} hasRepairs={recoveryIssues.length > 0}
        storageError={storageError} onResume={resumeDraft} onNew={resetDraft}
        onRetry={() => setHydrationAttempt(current => current + 1)} /> : children}
    </FieldReportContext.Provider>
  );
};
// hook truy xuất ngữ cảnh bản nháp báo cáo hiện trường cho các màn hình thành phần
export const useFieldReport = (): FieldReportContextValue => {
  const context = useContext(FieldReportContext);
  if (!context)
    throw new Error("useFieldReport must be used inside FieldReportProvider");
  return context;
};

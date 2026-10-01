import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { createEmptyFieldReportDraft, type FieldReportDraft } from "./types";

interface FieldReportContextValue {
  draft: FieldReportDraft;
  setDraft: Dispatch<SetStateAction<FieldReportDraft>>;
  resetDraft: () => void;
}

const FieldReportContext = createContext<FieldReportContextValue | null>(null);

export const FieldReportProvider = ({ children }: { children: ReactNode }) => {
  const [draft, setDraft] = useState<FieldReportDraft>(createEmptyFieldReportDraft);
  const resetDraft = useCallback(() => setDraft(createEmptyFieldReportDraft()), []);
  const value = useMemo(() => ({ draft, setDraft, resetDraft }), [draft, resetDraft]);

  return <FieldReportContext.Provider value={value}>{children}</FieldReportContext.Provider>;
};

export const useFieldReport = (): FieldReportContextValue => {
  const context = useContext(FieldReportContext);
  if (!context) throw new Error("useFieldReport must be used inside FieldReportProvider");
  return context;
};

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { createEmptyFieldReportDraft, type FieldReportDraft } from "./types";

interface FieldReportContextValue {
  draft: FieldReportDraft;
  setDraft: Dispatch<SetStateAction<FieldReportDraft>>;
  resetDraft: () => void;
}

const FieldReportContext = createContext<FieldReportContextValue | null>(null);
// khởi tạo nhà cung cấp ngữ cảnh lưu trữ bản nháp báo cáo hiện trường
export const FieldReportProvider = ({ children }: { children: ReactNode }) => {
  const [draft, setDraft] = useState<FieldReportDraft>(
    createEmptyFieldReportDraft,
  );
  // làm mới dữ liệu bản nháp về trạng thái khởi tạo ban đầu
  const resetDraft = useCallback(
    () => setDraft(createEmptyFieldReportDraft()),
    [],
  );
  const value = useMemo(
    () => ({ draft, setDraft, resetDraft }),
    [draft, resetDraft],
  );

  return (
    <FieldReportContext.Provider value={value}>
      {children}
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

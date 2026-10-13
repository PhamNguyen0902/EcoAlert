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
// nơi lưu tạm dữ liệu báo cáo để dùng chung qua các bước chụp ảnh và gửi bài
const FieldReportContext = createContext<FieldReportContextValue | null>(null);
// chia sẻ dữ liệu báo cáo đang tạo cho tất cả màn hình trong luồng báo cáo
export const FieldReportProvider = ({ children }: { children: ReactNode }) => {
  const [draft, setDraft] = useState<FieldReportDraft>(
    createEmptyFieldReportDraft,
  );
  // xóa ảnh chụp tạm trong máy và làm mới lại dữ liệu báo cáo từ đầu
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

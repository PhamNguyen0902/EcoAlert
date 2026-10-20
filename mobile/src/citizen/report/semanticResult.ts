import type { AlertCategory, PreSubmitSemanticResult, VisualMassEstimate, CreateAlertData } from "../../shared/types";
import type { FieldReportImageValidationDraft } from "./types";

// These are backend enum codes, not detector materials or Vietnamese labels.
export const reportCategoryCodes = ["illegal_dumping", "illegal_construction_waste", "illegal_burning", "water_pollution", "air_pollution", "flooding", "fallen_tree", "noise_pollution", "soil_contamination", "wildlife_threat", "other"] as const;
export const isReportCategory = (value: unknown): value is AlertCategory =>
  typeof value === "string" && (reportCategoryCodes as readonly string[]).includes(value);
const probability = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;

export function semanticErrorMessage(error: unknown): string {
  const e = error as { code?: string; response?: { status?: number; data?: { code?: string; providerStatus?: number } } };
  const providerStatus = e?.response?.data?.providerStatus;
  if (providerStatus === 402) return "Dịch vụ đánh giá AI chưa khả dụng do hạn mức nhà cung cấp (402). YOLO vẫn được giữ lại.";
  if (providerStatus === 401 || providerStatus === 403) return "Dịch vụ đánh giá AI chưa được nhà cung cấp cấp quyền.";
  if (providerStatus === 429) return "Nhà cung cấp AI đang giới hạn lượt gọi. Vui lòng thử lại sau.";
  if (e?.code === "ECONNABORTED" || e?.code === "ETIMEDOUT") return "Phân loại AI hết thời gian chờ. Vui lòng thử lại.";
  if (e?.response?.status === 503) return "Dịch vụ phân loại AI tạm thời không khả dụng (503).";
  if (error instanceof Error && error.message === "INVALID_SEMANTIC_RESPONSE") return "Dữ liệu phân loại AI trả về không hợp lệ.";
  return "Không thể kết nối dịch vụ phân loại AI. Vui lòng thử lại.";
}

export function mapSemanticResult(result: PreSubmitSemanticResult): Partial<FieldReportImageValidationDraft> {
  if (!result || !["IMAGE_AND_TEXT", "TEXT_ONLY"].includes(result.analysisMode)
    || !["AI_SUGGESTED", "UNCLASSIFIED"].includes(result.classificationStatus)
    || !["HIGH_CONFIDENCE", "REVIEW_REQUIRED", "UNCLASSIFIED"].includes(result.confidenceTier)
    || !probability(result.categoryConfidence) || !probability(result.incidentConfidence)
    || typeof result.isIncident !== "boolean") throw Error("INVALID_SEMANTIC_RESPONSE");
  if (result.classificationStatus === "AI_SUGGESTED" && !isReportCategory(result.category)) throw Error("INVALID_SEMANTIC_RESPONSE");
  // Thresholds belong to the AI service. Respect its status/tier; never lower them on mobile.
  const classified = result.analysisMode === "IMAGE_AND_TEXT" && result.isIncident
    && result.classificationStatus === "AI_SUGGESTED" && result.confidenceTier !== "UNCLASSIFIED" && isReportCategory(result.category);
  return {
    semanticResult: result,
    analysisMode: result.analysisMode,
    semanticState: result.analysisMode === "TEXT_ONLY" ? "TEXT_ONLY" : classified ? "COMPLETE" : "UNCLASSIFIED",
    semanticError: result.analysisMode === "TEXT_ONLY" ? "AI chưa đọc được ảnh; kết quả hiện chỉ dựa trên văn bản."
      : classified ? null : result.classificationReason === "LOW_CONFIDENCE" ? "Độ tin cậy phân loại dưới ngưỡng của hệ thống."
        : result.shortReason || "Không đủ dữ liệu để gợi ý danh mục sự cố.",
    suggestedCategory: classified ? result.category : null,
    categoryConfidence: result.categoryConfidence,
    severity: classified && ["low", "medium", "high", "critical"].includes(result.severity?.toLowerCase()) ? result.severity : null,
    summary: result.analysisMode === "IMAGE_AND_TEXT" ? result.overallSummary || result.summary || null : null,
    massEstimate: result.massEstimate,
  };
}

export function massPresentation(analysis: FieldReportImageValidationDraft): { value: string; note: string } {
  const m = analysis.massEstimate;
  const valid = m?.available === true && analysis.analysisMode === "IMAGE_AND_TEXT"
    && analysis.semanticState !== "UNAVAILABLE" && analysis.semanticResult?.isIncident === true
    && typeof m.minKg === "number" && Number.isFinite(m.minKg) && m.minKg >= 0
    && typeof m.maxKg === "number" && Number.isFinite(m.maxKg) && m.maxKg >= m.minKg
    && typeof m.mostLikelyKg === "number" && Number.isFinite(m.mostLikelyKg) && m.mostLikelyKg >= m.minKg && m.mostLikelyKg <= m.maxKg
    && probability(m.confidence);
  if (valid) return { value: `${m.minKg} – ${m.maxKg} kg`, note: "Ước tính từ ảnh — không phải khối lượng đo thực tế" };
  return { value: "Chưa có ước tính", note: analysis.analysisMode === "TEXT_ONLY" ? "Không có phân tích hình ảnh để ước tính."
    : m?.available ? "Kết quả khối lượng không đủ nhất quán để hiển thị."
      : m?.reasoningSummary || m?.limitations?.[0] || "Không đủ dữ liệu hình ảnh để ước tính." };
}

export function reportClassification(analysis: FieldReportImageValidationDraft): Pick<CreateAlertData, "category" | "classification"> {
  const user = isReportCategory(analysis.userSelectedCategory) ? analysis.userSelectedCategory : undefined;
  const suggestion = isReportCategory(analysis.suggestedCategory) ? analysis.suggestedCategory : undefined;
  // An AI suggestion is provenance, not the citizen's decision. Without an
  // explicit selection the existing backend creates UNCLASSIFIED for review.
  return { category: user, classification: user ? { selectedCategory: user, decision: user === suggestion ? "CONFIRM" : "CORRECT" } : undefined };
}

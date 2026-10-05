import { api } from "./client";

export interface RagCitation {
  chunk_id: string;
  title: string;
  score: number;
  source_url?: string;
  legal_basis?: string;
}

export interface RagAssistantResponse {
  answer: string;
  suggestedActions: string[];
  citations: RagCitation[];
}

export interface ChatHistoryItem {
  role: "user" | "assistant";
  text: string;
}

export const aiService = {
  /**
   * Gửi câu hỏi nghiệp vụ của cán bộ hiện trường tới RAG AI (kèm lịch sử hội thoại)
   * Backend Endpoint: POST /api/v1/ai/rag/officer-ask
   */
  askOfficerAssistant: async (
    question: string,
    category: string = "illegal_dumping",
    history: ChatHistoryItem[] = [],
  ): Promise<RagAssistantResponse> => {
    const res = await api.post("/v1/ai/rag/officer-ask", {
      question,
      category,
      history,
    });
    return res.data?.data || res.data;
  },
};
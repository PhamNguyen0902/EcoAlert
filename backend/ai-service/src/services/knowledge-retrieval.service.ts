import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import {
  KnowledgeChunkModel,
  IKnowledgeChunk,
} from "../models/knowledge-chunk.model";

export interface RetrievalFilter {
  category?: string;
  targetRole?: string;
  topK?: number;
  minScore?: number;
}

export interface RetrievedChunk {
  chunk_id: string;
  title: string;
  section_type: string;
  step_number?: number;
  related_actions?: string[];
  score: number;
  content: string;
}

export class KnowledgeRetrievalService {
  private genAI: GoogleGenerativeAI;
  private embeddingModel: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY chưa được cấu hình trong .env");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.embeddingModel = this.genAI.getGenerativeModel({
      model: "gemini-embedding-001",
    });
  }

  // Tính Cosine Similarity giữa 2 vector
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Hàm loại bỏ dấu tiếng Việt nội bộ cho service truy xuất
  private normalizeText(s: string): string {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .trim();
  }
  // Boost điểm khi từ khóa xuất hiện trong tiêu đề (hỗ trợ cả có dấu và không dấu)
  private lexicalBoost(query: string, title: string): number {
    const qNorm = this.normalizeText(query);
    const tNorm = this.normalizeText(title);
    const normalizedKeys = [
      "phat",
      "bao nhieu tien",
      "tham quyen",
      "duoi 1m",
      "tren 1m",
      "boc mui",
      "phan loai",
      "nghi dinh 45",
      "dieu 25",
      "dieu 26",
    ];
    let boost = 0;
    for (const k of normalizedKeys) {
      if (qNorm.includes(k) && tNorm.includes(k)) {
        boost += 0.04;
      }
    }
    return Math.min(boost, 0.1);
  }

  /**
   * Truy xuất Top-K chunks liên quan nhất từ MongoDB
   */
  async retrieve(
    query: string,
    filter: RetrievalFilter = {},
  ): Promise<RetrievedChunk[]> {
    const topK = filter.topK ?? 3;
    const minScore = filter.minScore ?? 0.65;

    // 1. Vector hóa câu hỏi của người dùng
    const queryRes = await this.embeddingModel.embedContent({
      content: { role: "user", parts: [{ text: query }] },
      taskType: TaskType.RETRIEVAL_QUERY,
    });
    const queryEmbedding: number[] = queryRes.embedding.values;

    // 2. Metadata Filtering trên MongoDB
    const mongoQuery: Record<string, any> = {
      category: filter.category ?? "illegal_dumping",
    };
    if (filter.targetRole) mongoQuery.target_role = filter.targetRole;

    const candidateChunks =
      await KnowledgeChunkModel.find(mongoQuery).lean<IKnowledgeChunk[]>();

    if (!candidateChunks || candidateChunks.length === 0) {
      return [];
    }

    // 3. Tính điểm tương đồng ngữ nghĩa
    const lowerQuery = query.toLowerCase();
    const scoredList = candidateChunks.map((chunk) => {
      let score = this.cosineSimilarity(queryEmbedding, chunk.embedding);

      // Boost 5% nếu query nhắc trực tiếp tên action
      if (chunk.related_actions && chunk.related_actions.length > 0) {
        for (const action of chunk.related_actions) {
          if (lowerQuery.includes(action.toLowerCase())) {
            score += 0.05;
            break;
          }
        }
      }

      // Boost theo từ khóa trong tiêu đề (độc lập với action)
      score += this.lexicalBoost(query, chunk.title);

      return {
        chunk_id: chunk.chunk_id,
        title: chunk.title,
        section_type: chunk.section_type,
        step_number: chunk.step_number,
        related_actions: chunk.related_actions,
        score: Math.min(score, 1.0),
        content: chunk.content,
      };
    });

    // 4. Sắp xếp giảm dần
    const ranked = scoredList.sort((a, b) => b.score - a.score);

    console.log(
      "[RAG] top scores:",
      ranked
        .slice(0, 3)
        .map((r) => `${(r.score * 100).toFixed(1)} ${r.chunk_id}`),
    );

    const passed = ranked.filter((item) => item.score >= minScore);
    if (passed.length === 0) return [];

    // Chỉ giữ chunk sát điểm cao nhất (chênh tối đa 0.06)
    const top = passed[0].score;
    return passed.filter((i) => top - i.score <= 0.06).slice(0, topK);
  }
}

export const knowledgeRetrievalService = new KnowledgeRetrievalService();

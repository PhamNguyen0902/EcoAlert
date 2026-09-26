import { GoogleGenerativeAI } from '@google/generative-ai';
import { KnowledgeChunkModel, IKnowledgeChunk } from '../models/knowledge-chunk.model';

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
      throw new Error('GEMINI_API_KEY chưa được cấu hình trong .env');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.embeddingModel = this.genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
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

  /**
   * Truy xuất Top-K chunks liên quan nhất từ MongoDB
   */
  async retrieve(query: string, filter: RetrievalFilter = {}): Promise<RetrievedChunk[]> {
    const topK = filter.topK || 3;
    const minScore = filter.minScore || 0.5;

    // 1. Vector hóa câu hỏi của người dùng
    const queryRes = await this.embeddingModel.embedContent(query);
    const queryEmbedding: number[] = queryRes.embedding.values;

    // 2. Metadata Filtering trên MongoDB
    const mongoQuery: Record<string, any> = {};
    if (filter.category) mongoQuery.category = filter.category;
    if (filter.targetRole) mongoQuery.target_role = filter.targetRole;

    const candidateChunks = await KnowledgeChunkModel.find(mongoQuery).lean<IKnowledgeChunk[]>();

    if (!candidateChunks || candidateChunks.length === 0) {
      return [];
    }

    // 3. Tính điểm tương đồng ngữ nghĩa (Cosine Similarity)
    const lowerQuery = query.toLowerCase();
    const scoredList = candidateChunks.map((chunk) => {
      let score = this.cosineSimilarity(queryEmbedding, chunk.embedding);

      // Keyword Boost (Hybrid nhẹ): nếu query nhắc trực tiếp tên action thì ưu tiên thêm 5%
      if (chunk.related_actions && chunk.related_actions.length > 0) {
        for (const action of chunk.related_actions) {
          if (lowerQuery.includes(action.toLowerCase())) {
            score += 0.05;
            break;
          }
        }
      }

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

    // 4. Sắp xếp điểm giảm dần và lấy Top-K thỏa minScore
    return scoredList
      .filter((item) => item.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

export const knowledgeRetrievalService = new KnowledgeRetrievalService();
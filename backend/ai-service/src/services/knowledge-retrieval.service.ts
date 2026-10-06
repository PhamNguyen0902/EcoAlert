import {
  GoogleGenerativeAI,
  GenerativeModel,
  TaskType,
} from "@google/generative-ai";
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
  /** cosine thô giữa câu hỏi và đoạn tài liệu (không cộng điểm thưởng) */
  score: number;
  content: string;
  // metadata nguồn, chỉ có khi tài liệu được nạp kèm các trường này
  source_url?: string;
  legal_basis?: string;
  effective_date?: string;
}

type ChunkExtras = {
  source_url?: string;
  legal_basis?: string;
  effective_date?: string | Date;
};

const DEFAULT_TOP_K = 3;
const DEFAULT_MIN_SCORE = Number(process.env.RAG_MIN_SCORE ?? 0.65);
// chỉ giữ các đoạn có điểm xếp hạng sát với đoạn tốt nhất
const RELATIVE_WINDOW = 0.06;
const CACHE_TTL_MS = 60_000;
const LEXICAL_STEP = 0.04;
const MAX_LEXICAL_BOOST = 0.1;

// từ khóa nghiệp vụ (đã bỏ dấu); có ranh giới từ để "phat" không khớp "phat hien"
const LEXICAL_KEYS: RegExp[] = [
  /\bphat\b/,
  /\bbao nhieu tien\b/,
  /\btham quyen\b/,
  /\bduoi 1m/,
  /\btren 1m/,
  /\bboc mui\b/,
  /\bphan loai\b/,
  /\bnghi dinh 45\b/,
  /\bdieu 6\b/,
  /\bdieu 25\b/,
  /\bdieu 26\b/,
  /\bto chuc\b/,
  /\bcong ty\b/,
  /\bdoanh nghiep\b/,
  /\broi vai\b/,
];

export class KnowledgeRetrievalService {
  private _embeddingModel?: GenerativeModel;
  private cache = new Map<string, { at: number; data: IKnowledgeChunk[] }>();

  // khởi tạo muộn để thiếu API key không làm sập server lúc import
  private get embeddingModel(): GenerativeModel {
    if (!this._embeddingModel) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY chưa được cấu hình trong .env");
      }
      this._embeddingModel = new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: "gemini-embedding-001",
      });
    }
    return this._embeddingModel;
  }

  // tính độ tương đồng cosin giữa hai vector đặc trưng
  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? NaN : dot / denom;
  }

  // chuẩn hóa chuỗi và loại bỏ dấu tiếng việt
  private normalizeText(s: string): string {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .trim();
  }

  // điểm thưởng nhỏ khi cùng một từ khóa nghiệp vụ xuất hiện ở cả câu hỏi và tiêu đề
  // chỉ dùng để xếp hạng, không dùng để vượt ngưỡng
  private lexicalBoost(qNorm: string, tNorm: string): number {
    let boost = 0;
    for (const re of LEXICAL_KEYS) {
      if (re.test(qNorm) && re.test(tNorm)) boost += LEXICAL_STEP;
    }
    return Math.min(boost, MAX_LEXICAL_BOOST);
  }

  private async embedQuery(query: string): Promise<number[]> {
    const res = await this.embeddingModel.embedContent({
      content: { role: "user", parts: [{ text: query }] },
      taskType: TaskType.RETRIEVAL_QUERY,
    });
    return res.embedding.values;
  }

  // đọc tài liệu theo danh mục và vai trò, có cache ngắn để tránh đọc DB mỗi câu hỏi
  private async loadCandidates(
    category: string,
    targetRole?: string,
  ): Promise<IKnowledgeChunk[]> {
    const key = `${category}|${targetRole ?? ""}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

    const mongoQuery: Record<string, any> = { category };
    if (targetRole) mongoQuery.target_role = targetRole;
    const data =
      await KnowledgeChunkModel.find(mongoQuery).lean<IKnowledgeChunk[]>();
    this.cache.set(key, { at: Date.now(), data: data ?? [] });
    return data ?? [];
  }

  /**
   * truy xuất danh sách đoạn tri thức phù hợp từ cơ sở dữ liệu
   * - ngưỡng minScore áp dụng trên cosine thô
   * - điểm thưởng từ khóa chỉ ảnh hưởng thứ tự xếp hạng
   */
  async retrieve(
    query: string,
    filter: RetrievalFilter = {},
  ): Promise<RetrievedChunk[]> {
    const topK = filter.topK ?? DEFAULT_TOP_K;
    const minScore = filter.minScore ?? DEFAULT_MIN_SCORE;

    const queryEmbedding = await this.embedQuery(query);
    const candidates = await this.loadCandidates(
      filter.category ?? "illegal_dumping",
      filter.targetRole,
    );
    if (candidates.length === 0) return [];

    const qNorm = this.normalizeText(query);
    const scored: { chunk: IKnowledgeChunk; cosine: number; rank: number }[] =
      [];

    for (const chunk of candidates) {
      if (
        !Array.isArray(chunk.embedding) ||
        chunk.embedding.length !== queryEmbedding.length
      ) {
        continue; // bỏ qua đoạn thiếu hoặc lệch số chiều vector
      }
      const cosine = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      if (!Number.isFinite(cosine)) continue;
      const rank =
        cosine + this.lexicalBoost(qNorm, this.normalizeText(chunk.title));
      scored.push({ chunk, cosine, rank });
    }

    scored.sort((a, b) => b.rank - a.rank);

    console.log(
      "[RAG] top:",
      scored
        .slice(0, 3)
        .map(
          (s) =>
            `${s.chunk.chunk_id} cos=${s.cosine.toFixed(3)} rank=${s.rank.toFixed(3)}`,
        ),
    );

    const passed = scored.filter((s) => s.cosine >= minScore);
    if (passed.length === 0) return [];

    const topRank = passed[0].rank;
    const maxCos = Math.max(...passed.map((s) => s.cosine));
    return passed
      .filter((s) => maxCos - s.cosine <= RELATIVE_WINDOW)
      .slice(0, topK)
      .map(({ chunk, cosine }) => {
        const extra = chunk as IKnowledgeChunk & ChunkExtras;
        return {
          chunk_id: chunk.chunk_id,
          title: chunk.title,
          section_type: chunk.section_type,
          step_number: chunk.step_number,
          related_actions: chunk.related_actions,
          score: cosine,
          content: chunk.content,
          source_url: extra.source_url,
          legal_basis: extra.legal_basis,
          effective_date:
            extra.effective_date instanceof Date
              ? extra.effective_date.toISOString().slice(0, 10)
              : extra.effective_date,
        };
      });
  }
}

export const knowledgeRetrievalService = new KnowledgeRetrievalService();

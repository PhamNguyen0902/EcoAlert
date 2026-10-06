import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import { DocumentChunk } from "./chunk-knowledge";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const KB_DIR = path.join(__dirname, "../../data/knowledge_base");
const INPUT_FILE = path.join(KB_DIR, "chunks.json");
const OUTPUT_FILE = path.join(KB_DIR, "embedded_chunks.json");

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error(
    "LỖI: Chưa cấu hình GEMINI_API_KEY trong file backend/ai-service/.env",
  );
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const embeddingModel = genAI.getGenerativeModel({
  model: "gemini-embedding-001",
});

export interface EmbeddedDocumentChunk extends DocumentChunk {
  embedding: number[];
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
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

async function runEmbedding() {
  console.log(`Đang đọc dữ liệu từ: ${INPUT_FILE}`);
  const chunks: DocumentChunk[] = JSON.parse(
    fs.readFileSync(INPUT_FILE, "utf-8"),
  );

  console.log(
    `Bắt đầu vector hóa ${chunks.length} chunks bằng Google Gemini "gemini-embedding-001"...`,
  );

  // gửi từng nhóm đoạn tri thức lên mô hình để tạo vector đặc trưng
  const BATCH_SIZE = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const response = await embeddingModel.batchEmbedContents({
      requests: batch.map((chunk) => ({
        content: { role: "user", parts: [{ text: chunk.content }] },
        taskType: TaskType.RETRIEVAL_DOCUMENT,
        title: chunk.title,
      })),
    });
    allEmbeddings.push(...response.embeddings.map((e: any) => e.values));
  }

  const embeddedChunks: EmbeddedDocumentChunk[] = chunks.map(
    (chunk, index) => ({
      ...chunk,
      embedding: allEmbeddings[index],
    }),
  );
  // lưu danh sách đoạn tri thức kèm vector đặc trưng ra tập tin
  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(embeddedChunks, null, 2),
    "utf-8",
  );
  console.log(`\nĐã vector hóa thành công ${embeddedChunks.length} chunks!`);
  console.log(
    `Kích thước vector: ${embeddedChunks[0].embedding.length} chiều.`,
  );
  console.log(`Đã xuất kết quả ra: ${OUTPUT_FILE}`);

  // kiểm tra thử nghiệm độ chính xác truy xuất với câu hỏi mẫu
  console.log("\n--- BẮT ĐẦU TEST THỬ NGHIỆM TRUY XUẤT ---");
  const testQuery = "Hành vi vứt rác sinh hoạt phạt bao nhiêu tiền?";
  console.log(`Câu hỏi test: "${testQuery}"`);

  const queryRes = await embeddingModel.embedContent({
    content: { role: "user", parts: [{ text: testQuery }] },
    taskType: TaskType.RETRIEVAL_QUERY,
  });
  const queryEmbedding = queryRes.embedding.values;

  const scoredChunks = embeddedChunks
    .map((chunk) => ({
      chunk_id: chunk.chunk_id,
      title: chunk.title,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score);

  console.log("Top 5 chunks liên quan nhất tìm được:");
  scoredChunks.slice(0, 5).forEach((item, i) => {
    console.log(
      `  ${i + 1}. [Score: ${(item.score * 100).toFixed(2)}%] ${item.chunk_id} - ${item.title}`,
    );
  });
}

runEmbedding().catch((err) => {
  console.error("Lỗi khi thực hiện embedding với Gemini:", err);
});

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { GoogleGenerativeAI } from '@google/generative-ai';
import { knowledgeRetrievalService, RetrievedChunk } from './knowledge-retrieval.service';

export interface RagResponse {
  answer: string;
  suggestedActions: string[];
  citations: {
    chunk_id: string;
    title: string;
    score: number;
  }[];
}

export class OfficerRagService {
  private genAI: GoogleGenerativeAI;
  private llmModel: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY chưa được cấu hình trong .env');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Sử dụng gemini-1.5-flash hoặc gemini-2.0-flash: tốc độ phản hồi cực nhanh, miễn phí và rất thông minh
    this.llmModel = this.genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });
  }

  async ask(question: string, category: string = 'illegal_dumping'): Promise<RagResponse> {
    // 1. RETRIEVAL: Truy xuất Top 3 chunks sát nhất từ MongoDB
    const relevantChunks: RetrievedChunk[] = await knowledgeRetrievalService.retrieve(question, {
      category,
      targetRole: 'OFFICER',
      topK: 3,
      minScore: 0.55,
    });

    // 2. AUGMENTATION: Ghép ngữ cảnh vào Prompt
    let contextText = '';
    const suggestedActionsSet = new Set<string>();

    if (relevantChunks.length > 0) {
      contextText = relevantChunks
        .map((chunk, index) => {
          if (chunk.related_actions) {
            chunk.related_actions.forEach((act) => suggestedActionsSet.add(act));
          }
          return `--- [Đoạn trích ${index + 1}: ${chunk.title}] ---\n${chunk.content}`;
        })
        .join('\n\n');
    } else {
      contextText = 'Không tìm thấy tài liệu quy trình nào phù hợp với câu hỏi này.';
    }

    const systemInstruction = `
Bạn là Trợ lý AI chuyên nghiệp hỗ trợ Cán bộ xử lý sự cố (Officer) của hệ thống bảo vệ môi trường EcoAlert.
Nhiệm vụ của bạn là hướng dẫn Officer thực hiện đúng quy trình nghiệp vụ và thao tác trên ứng dụng.

QUY TẮC BẮT BUỘC:
1. CHỈ trả lời dựa trên "NGỮ CẢNH ĐƯỢC CUNG CẤP" dưới đây. Nếu ngữ cảnh không có thông tin, hãy thông báo lịch sự rằng quy trình hiện tại chưa có hướng dẫn cho vấn đề này.
2. ĐẶC BIỆT LƯU Ý VỀ THẨM QUYỀN: Officer KHÔNG CÓ THẨM QUYỀN phạt tiền hoặc thu giữ/xử lý tài sản của người dân. Nếu người dân chống đối, Officer chỉ phối hợp với Công an hoặc UBND xã/phường.
3. Luôn trích dẫn rõ nguồn căn cứ (ví dụ: "Theo Bước 1...", "Theo FAQ 3...").
4. Nếu có liên quan đến thao tác app, hãy nêu rõ tên hành động (action) cần gọi trên hệ thống (ví dụ: startHandling, confirmArrival, resolveIncident).
5. Trả lời súc tích, gãy gọn, đúng trọng tâm nghiệp vụ cán bộ hiện trường.
`.trim();

    const userPrompt = `
NGỮ CẢNH ĐƯỢC CUNG CẤP:
${contextText}

---------------------------------
CÂU HỎI CỦA OFFICER:
"${question}"

HÃY TRẢ LỜI CHO OFFICER:
`.trim();

     // 3. GENERATION: Gửi sang LLM sinh câu trả lời (kèm Retry tự động nếu gặp lỗi 503)
    let answer = '';
    let retries = 3;
    while (retries > 0) {
      try {
        const result = await this.llmModel.generateContent({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
        });
        answer = result.response.text().trim();
        break;
      } catch (err: any) {
        retries--;
        if (retries === 0) throw err;
        console.warn(`[OfficerRagService] Google API nghẽn tạm thời (503). Đang tự động thử lại sau 2s... (còn ${retries} lần)`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    return {
      answer,
      suggestedActions: Array.from(suggestedActionsSet),
      citations: relevantChunks.map((c) => ({
        chunk_id: c.chunk_id,
        title: c.title,
        score: parseFloat((c.score * 100).toFixed(1)),
      })),
    };
  }
}
export const officerRagService = new OfficerRagService();
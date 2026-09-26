import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { officerRagService } from '../services/officer-rag.service';
import { knowledgeRetrievalService } from '../services/knowledge-retrieval.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ecoalert-ai-db';

interface TestCase {
  id: number;
  question: string;
  expectedChunkId: string;
  expectedKeywords: string[];
}

const TEST_SET: TestCase[] = [
  {
    id: 1,
    question: 'Tôi vừa được phân công (assigned) sự cố xả rác, việc đầu tiên tôi phải làm là gì?',
    expectedChunkId: 'chunk_06_faq_1',
    expectedKeywords: ['startHandling', 'in_progress'],
  },
  {
    id: 2,
    question: 'Khi đến hiện trường tôi cần thao tác gì đầu tiên?',
    expectedChunkId: 'chunk_07_faq_2',
    expectedKeywords: ['confirmArrival', 'GPS'],
  },
  {
    id: 3,
    question: 'Nếu bắt gặp người đang vứt rác, tôi có được phạt tiền họ không?',
    expectedChunkId: 'chunk_08_faq_3',
    expectedKeywords: ['không', 'thẩm quyền'],
  },
  {
    id: 4,
    question: 'Rác ít dưới 1m3 thì liên hệ ai dọn?',
    expectedChunkId: 'chunk_09_faq_4',
    expectedKeywords: ['tổ dân phố', 'dân quân'],
  },
  {
    id: 5,
    question: 'Rác nhiều trên 1m3 hoặc bốc mùi nguy hại thì xử lý thế nào?',
    expectedChunkId: 'chunk_10_faq_5',
    expectedKeywords: ['URENCO', 'chuyên dụng'],
  },
  {
    id: 6,
    question: 'Để hoàn tất và đóng sự cố trên hệ thống tôi cần những gì?',
    expectedChunkId: 'chunk_11_faq_6',
    expectedKeywords: ['resolveIncident', 'ảnh'],
  },
  {
    id: 7,
    question: 'Khu vực dọn xong có cần cắm biển cảnh báo không?',
    expectedChunkId: 'chunk_12_faq_7',
    expectedKeywords: ['cắm biển', 'cảnh báo'],
  },
];

async function runEvaluation() {
  console.log('Đang kết nối MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Bắt đầu đánh giá hiệu năng Pipeline RAG trên 7 câu Test Cases...\n');

  let hitCount = 0;
  let totalRetrievalTime = 0;
  let totalGenerationTime = 0;
  const results: any[] = [];

  for (const tc of TEST_SET) {
    const t0 = Date.now();
    // 1. Đo thời gian Retrieval
    const retrieved = await knowledgeRetrievalService.retrieve(tc.question, {
      category: 'illegal_dumping',
      targetRole: 'OFFICER',
      topK: 3,
    });
    const tRetrieval = Date.now() - t0;
    totalRetrievalTime += tRetrieval;

    // Kiểm tra xem chunk mong đợi có nằm trong Top 3 không
    const isHit = retrieved.some((c) => c.chunk_id.includes(tc.expectedChunkId));
    if (isHit) hitCount++;

    const top1Score = retrieved.length > 0 ? (retrieved[0].score * 100).toFixed(1) : '0';

    // 2. Đo thời gian End-to-End RAG (kèm Generation)
    const t1 = Date.now();
    const ragRes = await officerRagService.ask(tc.question);
    const tTotal = Date.now() - t1;
    totalGenerationTime += tTotal;

    // Kiểm tra từ khóa trong câu trả lời
    const answerLower = ragRes.answer.toLowerCase();
    const hasKeywords = tc.expectedKeywords.every((kw) => answerLower.includes(kw.toLowerCase()));

    results.push({
      ID: `TC-${tc.id}`,
      'Hit Top-3': isHit ? 'PASSED' : 'FAILED',
      'Top-1 Score': `${top1Score}%`,
      'Keywords Match': hasKeywords ? 'MATCH' : 'PARTIAL',
      'Retrieval (ms)': `${tRetrieval}ms`,
      'Total Latency': `${tTotal}ms`,
    });
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log('================ BẢNG KẾT QUẢ ĐÁNH GIÁ (EVALUATION REPORT) ================');
  console.table(results);

  const hitRate = ((hitCount / TEST_SET.length) * 100).toFixed(1);
  const avgRetrieval = (totalRetrievalTime / TEST_SET.length).toFixed(0);
  const avgTotal = (totalGenerationTime / TEST_SET.length).toFixed(0);

  console.log('---------------- TỔNG KẾT CHỈ SỐ ĐỊNH LƯỢNG ----------------');
  console.log(`- Độ chính xác truy xuất (Hit Rate @ 3): ${hitRate}% (${hitCount}/${TEST_SET.length})`);
  console.log(`- Thời gian truy xuất MongoDB trung bình: ${avgRetrieval} ms`);
  console.log(`- Thời gian xử lý toàn trình (RAG Latency): ${avgTotal} ms`);
  console.log('===========================================================================');

  await mongoose.disconnect();
}

runEvaluation().catch(console.error);
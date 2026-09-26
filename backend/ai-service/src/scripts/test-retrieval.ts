import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { GoogleGenerativeAI } from '@google/generative-ai';
import { KnowledgeChunkModel, IKnowledgeChunk } from '../models/knowledge-chunk.model';
import mongoose from 'mongoose';
import { knowledgeRetrievalService } from '../services/knowledge-retrieval.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ecoalert-ai-db';

async function runTest() {
  console.log('Đang kết nối MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB sẵn sàng!\n');

  // Bộ 3 câu hỏi thực tế của Officer để test độ chính xác
  const testCases = [
    'Tôi vừa đến hiện trường thì phải làm những gì?',
    'Khối lượng rác lớn trên 1m3 và bốc mùi hôi thối thì liên hệ ai xử lý?',
    'Bắt quả tang người xả rác thì tôi có quyền phạt tiền họ không?',
  ];

  for (const query of testCases) {
    console.log(`====================================================`);
    console.log(`CÂU HỎI: "${query}"`);
    
    const results = await knowledgeRetrievalService.retrieve(query, {
      category: 'illegal_dumping',
      targetRole: 'OFFICER',
      topK: 2,
    });

    console.log(`\nKẾT QUẢ TRUY XUẤT (Top ${results.length}):`);
    results.forEach((res, i) => {
      console.log(`  [Top ${i + 1}] Độ khớp: ${(res.score * 100).toFixed(1)}% | ${res.chunk_id}`);
      console.log(`         Tiêu đề: ${res.title}`);
      if (res.related_actions && res.related_actions.length > 0) {
        console.log(`         Actions: [${res.related_actions.join(', ')}]`);
      }
    });
    console.log('\n');
  }

  await mongoose.disconnect();
}

runTest().catch(console.error);
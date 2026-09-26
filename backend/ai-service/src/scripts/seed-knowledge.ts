import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { KnowledgeChunkModel } from '../models/knowledge-chunk.model';
import { EmbeddedDocumentChunk } from './embed-chunks';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const KB_DIR = path.join(__dirname, '../../data/knowledge_base');
const INPUT_FILE = path.join(KB_DIR, 'embedded_chunks.json');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ecoalert-ai-db';

async function seedKnowledge() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`LỖI: Không tìm thấy file dữ liệu vector tại: ${INPUT_FILE}`);
    process.exit(1);
  }

  const chunks: EmbeddedDocumentChunk[] = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`Đang đọc ${chunks.length} chunks từ file...`);

  console.log(`Đang kết nối MongoDB: ${MONGO_URI}...`);
  await mongoose.connect(MONGO_URI);
  console.log('Kết nối MongoDB thành công!');

  let insertedCount = 0;
  let updatedCount = 0;

  for (const chunk of chunks) {
    const res = await KnowledgeChunkModel.updateOne(
      { chunk_id: chunk.chunk_id },
      { $set: chunk },
      { upsert: true }
    );

    if (res.upsertedCount > 0) insertedCount++;
    else if (res.modifiedCount > 0) updatedCount++;
  }

  console.log(`\n--- KẾT QUẢ ĐỒNG BỘ VECTOR DATABASE ---`);
  console.log(`- Thêm mới: ${insertedCount} chunks`);
  console.log(`- Cập nhật: ${updatedCount} chunks`);
  console.log(`- Tổng cộng trong DB: ${await KnowledgeChunkModel.countDocuments()} chunks`);

  await mongoose.disconnect();
  console.log('Đã đóng kết nối MongoDB.');
}

seedKnowledge().catch((err) => {
  console.error('Lỗi khi nạp dữ liệu vào MongoDB:', err);
  process.exit(1);
});
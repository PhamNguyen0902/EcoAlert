import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// Định nghĩa cấu trúc của một Chunk
export interface DocumentChunk {
  chunk_id: string;
  document_id: string;
  category: string;
  target_role: string;
  doc_type: string;
  section_type: 'overview' | 'step' | 'faq';
  step_number?: number;
  title: string;
  related_actions?: string[];
  content: string;
  char_count: number;
}

const KB_DIR = path.join(__dirname, '../../data/knowledge_base');
const SOURCE_FILE = path.join(KB_DIR, 'quy_trinh_xu_ly_rac_officer.md');
const OUTPUT_FILE = path.join(KB_DIR, 'chunks.json');

function extractActions(text: string): string[] {
  const actions: string[] = [];
  if (text.includes('startHandling')) actions.push('startHandling');
  if (text.includes('confirmArrival')) actions.push('confirmArrival');
  if (text.includes('resolveIncident')) actions.push('resolveIncident');
  return actions;
}

function runChunking() {
  console.log(`Đang đọc file: ${SOURCE_FILE}`);
  const rawFile = fs.readFileSync(SOURCE_FILE, 'utf-8');

  // 1. Phân tách Frontmatter và phần nội dung Markdown
  const parsed = matter(rawFile);
  const metadata = parsed.data;
  const content = parsed.content;

  const chunks: DocumentChunk[] = [];

  // 2. Tách Chunk Tổng quan (Trước khi vào BƯỚC 1)
  const overviewMatch = content.match(/# QUY TRÌNH XỬ LÝ SỰ CỐ XẢ RÁC BỪA BÃI[^\n]*\n([\s\S]*?)---/);
  if (overviewMatch) {
    const overviewText = overviewMatch[1].trim();
    chunks.push({
      chunk_id: `${metadata.document_id}_chunk_00_overview`,
      document_id: metadata.document_id,
      category: metadata.category,
      target_role: metadata.target_role,
      doc_type: metadata.doc_type,
      section_type: 'overview',
      title: 'Tổng quan quy trình và mục tiêu Officer',
      content: `[Quy trình xử lý sự cố xả rác bừa bãi > Tổng quan]\n${overviewText}`,
      char_count: overviewText.length,
    });
  }

  // 3. Tách 5 Bước nghiệp vụ (BƯỚC 1 đến BƯỚC 5)
  const stepRegex = /## (BƯỚC (\d):[^\n]+)\n([\s\S]*?)(?=---|\n## CÂU HỎI)/g;
  let stepMatch;
  while ((stepMatch = stepRegex.exec(content)) !== null) {
    const stepTitle = stepMatch[1].trim();
    const stepNumber = parseInt(stepMatch[2], 10);
    const stepBody = stepMatch[3].trim();

    chunks.push({
      chunk_id: `${metadata.document_id}_chunk_${String(stepNumber).padStart(2, '0')}_step_${stepNumber}`,
      document_id: metadata.document_id,
      category: metadata.category,
      target_role: metadata.target_role,
      doc_type: metadata.doc_type,
      section_type: 'step',
      step_number: stepNumber,
      title: stepTitle,
      related_actions: extractActions(stepBody),
      content: `[Quy trình xử lý sự cố xả rác bừa bãi > ${stepTitle}]\n${stepBody}`,
      char_count: stepBody.length,
    });
  }

  // 4. Tách các câu FAQ (Hỏi & Đáp)
  const faqSection = content.split('## CÂU HỎI THƯỜNG GẶP CỦA OFFICER (FAQ)')[1];
  if (faqSection) {
    const faqRegex = /\*\*Hỏi:\s*([^\n]+)\*\*\s*\nĐáp:\s*([^\n]+)/g;
    let faqMatch;
    let faqIndex = 1;
    while ((faqMatch = faqRegex.exec(faqSection)) !== null) {
      const question = faqMatch[1].trim();
      const answer = faqMatch[2].trim();
      const faqContent = `Hỏi: ${question}\nĐáp: ${answer}`;

      chunks.push({
        chunk_id: `${metadata.document_id}_chunk_${String(5 + faqIndex).padStart(2, '0')}_faq_${faqIndex}`,
        document_id: metadata.document_id,
        category: metadata.category,
        target_role: metadata.target_role,
        doc_type: metadata.doc_type,
        section_type: 'faq',
        title: `FAQ ${faqIndex}: ${question}`,
        related_actions: extractActions(faqContent),
        content: `[Quy trình xử lý sự cố xả rác bừa bãi > FAQ]\n${faqContent}`,
        char_count: faqContent.length,
      });
      faqIndex++;
    }
  }

  // 5. Lưu ra file JSON
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(chunks, null, 2), 'utf-8');
  console.log(`\nĐã chia thành công: ${chunks.length} chunks!`);
  console.log(`Đã xuất kết quả ra: ${OUTPUT_FILE}`);

  console.log('\n--- DANH SÁCH CHUNKS ĐÃ TẠO ---');
  chunks.forEach((c, idx) => {
    console.log(`${idx + 1}. [${c.section_type}] ${c.chunk_id} - ${c.title} (${c.char_count} chars)`);
  });
}

runChunking();
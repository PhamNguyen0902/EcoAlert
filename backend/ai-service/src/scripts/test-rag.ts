import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { officerRagService } from "../services/officer-rag.service";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/ecoalert-ai-db";

async function runRagTest() {
  console.log("Đang kết nối MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("MongoDB đã sẵn sàng!\n");

  // Thử hỏi 2 câu tình huống hóc búa của Officer:
  const questions = [
    "Tôi vừa đến hiện trường bãi rác, trên app tôi phải bấm gì và kiểm tra những gì?",
    "Người dân ở đây đổ rác trộm tôi bắt quả tang tại trận, tôi có được tịch thu xe máy và lập biên bản phạt 2 triệu không?",
    "Khi gặp bãi rác lớn, tôi cần làm gì",
  ];

  for (const q of questions) {
    console.log(
      `======================================================================`,
    );
    console.log(`OFFICER HỎI: "${q}"\n`);

    const response = await officerRagService.ask(q);

    console.log(`TRỢ LÝ AI TRẢ LỜI:\n${response.answer}\n`);
    console.log(
      `Gợi ý Actions hệ thống: [${response.suggestedActions.join(", ")}]`,
    );
    console.log(`Căn cứ trích dẫn:`);
    response.citations.forEach((c) => {
      console.log(`  - ${c.title} (Độ khớp: ${c.score}%)`);
    });
    console.log("\n");
  }

  await mongoose.disconnect();
}

runRagTest().catch(console.error);

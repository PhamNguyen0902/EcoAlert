import OpenAI from 'openai';

const openrouter = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    // Ép kiểu (as string) để TypeScript hiểu đây chắc chắn là một chuỗi
    apiKey: process.env.OPENROUTER_API_KEY as string,
    defaultHeaders: {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "EcoAlert System",
    }
});

export const analyzeIncidentWithOpenRouter = async (description: string) => {
    try {
        const response = await openrouter.chat.completions.create({
            // Đã đổi sang model trả phí xịn và ổn định nhất
            model: 'meta-llama/llama-3.1-8b-instruct',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert environmental officer. 
          Categorize the incident into strictly ONE of these exact values: ["illegal_dumping", "water_pollution", "air_pollution", "illegal_burning", "flooding", "fallen_tree", "noise_pollution", "other"].
          Assess the severity into strictly ONE of these exact values: ["low", "medium", "high", "critical"].
          Respond ONLY in valid JSON format with: "category", "severity", "confidence" (0-100), and "analysis_note" (short reason). Do not output any markdown or explanation outside the JSON.`
                },
                {
                    role: 'user',
                    content: `Analyze this incident report: "${description}"`
                },
            ],
            temperature: 0.1,
        });

        const resultString = response.choices[0].message.content;
        if (!resultString) throw new Error("Không nhận được phản hồi từ OpenRouter");

        // 1. Dọn dẹp chuỗi JSON phòng trường hợp AI sinh ra thêm markdown
        const cleanJsonString = resultString.replace(/```json/g, '').replace(/```/g, '').trim();
        const analysisResult = JSON.parse(cleanJsonString);

        // 2. Chuẩn hóa Confidence về dạng thập phân (0 - 1) để Frontend hiển thị đúng phần trăm
        if (analysisResult.confidence && analysisResult.confidence > 1) {
            analysisResult.confidence = analysisResult.confidence / 100;
        }

        return analysisResult;

    } catch (error) {
        console.error('Lỗi khi gọi OpenRouter API:', error);
        throw error;
    }
};
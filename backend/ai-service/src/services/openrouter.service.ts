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

export const analyzeIncidentWithOpenRouter = async (description: string, imageUrl?: string) => {
    try {
        const userContent: any = imageUrl 
            ? [
                { type: 'text', text: `Analyze this incident report with description: "${description || 'No description provided'}". Suggest an appropriate title, category, and severity.` },
                { type: 'image_url', image_url: { url: imageUrl } }
              ]
            : `Analyze this incident report: "${description}"`;

        const response = await openrouter.chat.completions.create({
            model: 'meta-llama/llama-3.1-8b-instruct',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert environmental officer. 
            Categorize the incident into strictly ONE of these exact values: ["illegal_dumping", "water_pollution", "air_pollution", "illegal_burning", "flooding", "fallen_tree", "noise_pollution", "other"].
            
            Assess the severity into strictly ONE of these exact values ["low", "medium", "high", "critical"].

            Respond ONLY in valid JSON format with keys:
            - "category": string
            - "severity": string ("LOW", "MEDIUM", "HIGH", or "CRITICAL")
            - "suggested_title": string (Short title in Vietnamese, max 10 words)
            - "suggested_description": string (Clear description of incident in Vietnamese)
            - "confidence": number (0-100)
            - "analysis_note": short explanation string in Vietnamese.
            
            Do not output any markdown or explanation outside the JSON.`
                },
                {
                    role: 'user',
                    content: userContent
                },
            ],
            temperature: 0.1,
        });

        const resultString = response.choices[0].message.content;
        if (!resultString) throw new Error("Không nhận được phản hồi từ OpenRouter");

        const cleanJsonString = resultString.replace(/```json/g, '').replace(/```/g, '').trim();
        const analysisResult = JSON.parse(cleanJsonString);

        if (analysisResult.confidence && analysisResult.confidence > 1) {
            analysisResult.confidence = analysisResult.confidence / 100;
        }

        if (analysisResult.severity) {
            analysisResult.severity = analysisResult.severity.toUpperCase();
        }

        return analysisResult;

    } catch (error) {
        console.error('Lỗi khi gọi OpenRouter API:', error);
        throw error;
    }
};
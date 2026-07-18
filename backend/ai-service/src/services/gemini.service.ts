import { GoogleGenerativeAI } from '@google/generative-ai';
import { envConfig } from '../config/env.config';
import { createLogger, AlertCategory, Severity } from '@ecoalert/shared';
import axios from 'axios';

const logger = createLogger('ai-service');

export class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(envConfig.geminiApiKey);
  }

  async analyzeImage(imageUrl: string) {
    try {
      if (envConfig.geminiApiKey === 'YOUR_API_KEY') {
        logger.warn('Using placeholder API key. Simulating AI response.');
        return {
          category: AlertCategory.ILLEGAL_DUMPING,
          confidence: 0.85,
          suggestedPriority: Severity.MEDIUM
        };
      }

      // Download image as base64
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const base64Image = Buffer.from(response.data, 'binary').toString('base64');
      const mimeType = response.headers['content-type'] as string || 'image/jpeg';

      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `
        Analyze this image of an environmental incident.
        Return ONLY a JSON object (no markdown, no backticks) with the following exact keys:
        - "category": Must be exactly one of: ILLEGAL_DUMPING, WATER_POLLUTION, AIR_POLLUTION, ILLEGAL_BURNING, FLOODING, FALLEN_TREE, NOISE_POLLUTION, DEAD_ANIMAL, DANGEROUS_INFRASTRUCTURE, BLOCKED_DRAIN, OTHER
        - "confidence": A number between 0 and 1 indicating how confident you are in this classification.
        - "suggestedPriority": Must be exactly one of: LOW, MEDIUM, HIGH, CRITICAL.
      `;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Image, mimeType } }
      ]);
      
      const text = result.response.text().trim();
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '');
      const parsed = JSON.parse(cleanText);
      
      return {
        category: parsed.category || 'OTHER',
        confidence: parsed.confidence || 0.5,
        suggestedPriority: parsed.suggestedPriority || 'LOW'
      };
    } catch (error) {
      logger.error('Gemini API Error:', error);
      return {
        category: 'UNCLASSIFIED',
        confidence: 0,
        suggestedPriority: 'LOW'
      };
    }
  }
}

export const geminiService = new GeminiService();

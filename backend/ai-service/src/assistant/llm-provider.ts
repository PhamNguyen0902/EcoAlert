import OpenAI from 'openai';
import { envConfig } from '../config/env.config';

export interface ChatHistoryTurn {
  role: 'USER' | 'ASSISTANT';
  content: string;
}

export interface AssistantLlmProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  generate(
    systemPrompt: string,
    history: ChatHistoryTurn[],
    userMessage: string,
  ): Promise<string>;
}

class DisabledLlmProvider implements AssistantLlmProvider {
  readonly name = 'disabled';
  readonly isConfigured = false;

  async generate(): Promise<string> {
    throw new Error('Assistant provider is not configured');
  }
}

class OpenAiCompatibleProvider implements AssistantLlmProvider {
  readonly isConfigured = true;

  private readonly client: OpenAI;

  constructor(
    readonly name: string,
    apiKey: string,
    baseURL?: string,
  ) {
    this.client = new OpenAI({
      apiKey,
      baseURL,
      maxRetries: 1,
      timeout: 15_000,
    });
  }

  async generate(
    systemPrompt: string,
    history: ChatHistoryTurn[],
    userMessage: string,
  ): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: envConfig.chatModel,
      temperature: 0.2,
      max_tokens: 700,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.map((turn) => ({
          role: turn.role === 'USER' ? ('user' as const) : ('assistant' as const),
          content: turn.content,
        })),
        { role: 'user', content: userMessage },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error('Assistant provider returned no content');
    return text;
  }
}

export const createAssistantLlmProvider = (): AssistantLlmProvider => {
  if (envConfig.chatProvider === 'openai' && envConfig.openAiApiKey) {
    return new OpenAiCompatibleProvider(
      'openai',
      envConfig.openAiApiKey,
      envConfig.openAiBaseUrl,
    );
  }

  if (envConfig.chatProvider === 'openrouter' && envConfig.openRouterApiKey) {
    return new OpenAiCompatibleProvider(
      'openrouter',
      envConfig.openRouterApiKey,
      envConfig.openAiBaseUrl || 'https://openrouter.ai/api/v1',
    );
  }

  return new DisabledLlmProvider();
};

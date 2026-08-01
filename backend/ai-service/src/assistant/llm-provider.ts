import { AiTask } from '../services/ai-task-router';
import {
  getOpenRouterProvider,
  OpenRouterProvider,
} from '../services/openrouter.service';

export interface ChatHistoryTurn {
  role: 'USER' | 'ASSISTANT';
  content: string;
}

export interface AssistantGenerationResult {
  content: string;
  provider: 'openrouter';
  model: string;
}

export interface AssistantLlmProvider {
  readonly name: 'openrouter';
  readonly isConfigured: true;
  generate(
    systemPrompt: string,
    history: ChatHistoryTurn[],
    userMessage: string,
  ): Promise<AssistantGenerationResult>;
}

type OpenRouterProviderResolver = () => OpenRouterProvider;

class OpenRouterAssistantProvider implements AssistantLlmProvider {
  readonly name = 'openrouter' as const;
  readonly isConfigured = true as const;

  constructor(private readonly resolveProvider: OpenRouterProviderResolver) {}

  async generate(
    systemPrompt: string,
    history: ChatHistoryTurn[],
    userMessage: string,
  ): Promise<AssistantGenerationResult> {
    const generation = await this.resolveProvider().generate(AiTask.CHAT, {
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

    const content = generation.response.choices[0]?.message?.content?.trim();
    if (!content) throw new Error('Assistant provider returned no content');
    return { content, provider: 'openrouter', model: generation.model };
  }
}

export const createAssistantLlmProvider = (
  resolveProvider: OpenRouterProviderResolver = getOpenRouterProvider,
): AssistantLlmProvider => new OpenRouterAssistantProvider(resolveProvider);

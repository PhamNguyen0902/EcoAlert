export interface OpenRouterConfig {
  apiKey: string;
  baseURL: string;
  analysisModel: string;
  chatModel: string;
  analysisFallbackModel?: string;
  chatFallbackModel?: string;
  siteURL: string;
  appName: string;
  legacyModelTasks: Array<'INCIDENT_ANALYSIS' | 'CHAT'>;
}

export class OpenRouterConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenRouterConfigurationError';
  }
}

const trimmed = (value?: string): string | undefined => {
  const normalized = value?.trim();
  return normalized || undefined;
};

export const readOpenRouterConfig = (
  environment: NodeJS.ProcessEnv = process.env,
): OpenRouterConfig => {
  const apiKey = trimmed(environment.OPENROUTER_API_KEY);
  const legacyModel = trimmed(environment.OPENROUTER_MODEL);
  const configuredAnalysisModel = trimmed(environment.OPENROUTER_ANALYSIS_MODEL);
  const configuredChatModel = trimmed(environment.OPENROUTER_CHAT_MODEL);
  const analysisModel = configuredAnalysisModel || legacyModel;
  const chatModel = configuredChatModel || legacyModel;

  if (!apiKey) {
    throw new OpenRouterConfigurationError(
      'OPENROUTER_API_KEY is required and must not be blank.',
    );
  }
  if (!analysisModel) {
    throw new OpenRouterConfigurationError(
      'OPENROUTER_ANALYSIS_MODEL is required (or configure legacy OPENROUTER_MODEL temporarily).',
    );
  }
  if (!chatModel) {
    throw new OpenRouterConfigurationError(
      'OPENROUTER_CHAT_MODEL is required (or configure legacy OPENROUTER_MODEL temporarily).',
    );
  }

  const legacyModelTasks: OpenRouterConfig['legacyModelTasks'] = [];
  if (!configuredAnalysisModel && legacyModel) legacyModelTasks.push('INCIDENT_ANALYSIS');
  if (!configuredChatModel && legacyModel) legacyModelTasks.push('CHAT');

  return {
    apiKey,
    analysisModel,
    chatModel,
    analysisFallbackModel: trimmed(environment.OPENROUTER_ANALYSIS_FALLBACK_MODEL),
    chatFallbackModel: trimmed(environment.OPENROUTER_CHAT_FALLBACK_MODEL),
    baseURL: trimmed(environment.OPENROUTER_BASE_URL) || 'https://openrouter.ai/api/v1',
    siteURL: trimmed(environment.OPENROUTER_SITE_URL) || 'http://localhost:5173',
    appName: trimmed(environment.OPENROUTER_APP_NAME) || 'EcoAlert',
    legacyModelTasks,
  };
};

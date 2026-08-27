export interface OpenRouterConfig {
  apiKey: string;
  baseURL: string;
  analysisModel: string;
  analysisFallbackModel?: string;
  siteURL: string;
  appName: string;
  usesLegacyModel: boolean;
}

export class OpenRouterConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenRouterConfigurationError';
  }
}

const trimmed = (value?: string): string | undefined => value?.trim() || undefined;

/** Reads only the model configuration needed by direct incident analysis. */
export const readOpenRouterConfig = (
  environment: NodeJS.ProcessEnv = process.env,
): OpenRouterConfig => {
  const apiKey = trimmed(environment.OPENROUTER_API_KEY);
  const legacyModel = trimmed(environment.OPENROUTER_MODEL);
  const configuredAnalysisModel = trimmed(environment.OPENROUTER_ANALYSIS_MODEL);
  const analysisModel = configuredAnalysisModel || legacyModel;

  if (!apiKey) throw new OpenRouterConfigurationError('OPENROUTER_API_KEY is required and must not be blank.');
  if (!analysisModel) {
    throw new OpenRouterConfigurationError(
      'OPENROUTER_ANALYSIS_MODEL is required (or configure legacy OPENROUTER_MODEL temporarily).',
    );
  }

  return {
    apiKey,
    analysisModel,
    analysisFallbackModel: trimmed(environment.OPENROUTER_ANALYSIS_FALLBACK_MODEL),
    baseURL: trimmed(environment.OPENROUTER_BASE_URL) || 'https://openrouter.ai/api/v1',
    siteURL: trimmed(environment.OPENROUTER_SITE_URL) || 'http://localhost:5173',
    appName: trimmed(environment.OPENROUTER_APP_NAME) || 'EcoAlert',
    usesLegacyModel: !configuredAnalysisModel && Boolean(legacyModel),
  };
};

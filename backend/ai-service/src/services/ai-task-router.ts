import { OpenRouterConfig } from '../config/openrouter.config';

export enum AiTask {
  INCIDENT_ANALYSIS = 'INCIDENT_ANALYSIS',
  IMAGE_VALIDATION = 'IMAGE_VALIDATION',
}

export const resolveModel = (_task: AiTask, config: OpenRouterConfig): string => config.analysisModel;
export const resolveFallbackModel = (_task: AiTask, config: OpenRouterConfig): string | undefined =>
  config.analysisFallbackModel;

import { OpenRouterConfig } from '../config/openrouter.config';

export enum AiTask {
  INCIDENT_ANALYSIS = 'INCIDENT_ANALYSIS',
  IMAGE_VALIDATION = 'IMAGE_VALIDATION',
  CHAT = 'CHAT',
}

export const resolveModel = (task: AiTask, config: OpenRouterConfig): string => {
  switch (task) {
    case AiTask.INCIDENT_ANALYSIS:
    case AiTask.IMAGE_VALIDATION:
      return config.analysisModel;
    case AiTask.CHAT:
      return config.chatModel;
    default:
      throw new Error(`Unsupported AI task: ${String(task)}`);
  }
};

export const resolveFallbackModel = (
  task: AiTask,
  config: OpenRouterConfig,
): string | undefined => {
  switch (task) {
    case AiTask.INCIDENT_ANALYSIS:
    case AiTask.IMAGE_VALIDATION:
      return config.analysisFallbackModel;
    case AiTask.CHAT:
      return config.chatFallbackModel;
    default:
      throw new Error(`Unsupported AI task: ${String(task)}`);
  }
};

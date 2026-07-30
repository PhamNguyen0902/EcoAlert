import mongoose from 'mongoose';
import { createLogger } from '@ecoalert/shared';
import { envConfig } from './env.config';

const logger = createLogger('ai-service');

// Keep assistant history and read-only incident access on explicit connections.
// This prevents the assistant's own data from being accidentally stored with
// operational incidents, while still allowing a minimal read model for RAG.
export const assistantConnection = mongoose.createConnection();
export const alertReadConnection = mongoose.createConnection();

export const connectDatabases = async (): Promise<void> => {
  await Promise.all([
    assistantConnection.openUri(envConfig.mongoUri),
    alertReadConnection.openUri(envConfig.alertMongoUri),
  ]);
  logger.info('Connected to assistant and read-only alert MongoDB databases');
};

export const disconnectDatabases = async (): Promise<void> => {
  await Promise.all([assistantConnection.close(), alertReadConnection.close()]);
};

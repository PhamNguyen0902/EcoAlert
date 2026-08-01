import { app } from './app';
import { createLogger } from '@ecoalert/shared';
import { rabbitMQService } from './services/rabbitmq.service';
import { connectDatabases, disconnectDatabases } from './config/database.config';
import { envConfig } from './config/env.config';
import { initializeOpenRouter } from './services/openrouter.service';

const logger = createLogger('ai-service');

const startServer = async () => {
  try {
    initializeOpenRouter();
    await connectDatabases();
    await rabbitMQService.connect();
    
    app.listen(envConfig.port, () => {
      logger.info(`AI Service is running on port ${envConfig.port}`);
    });
  } catch (error) {
    logger.error('Failed to start AI Service:', error);
    process.exit(1);
  }
};

startServer();

const shutdown = async () => {
  await disconnectDatabases();
  process.exit(0);
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

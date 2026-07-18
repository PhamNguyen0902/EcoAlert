import { app } from './app';
import dotenv from 'dotenv';
import { createLogger } from '@ecoalert/shared';
import { rabbitMQService } from './services/rabbitmq.service';

dotenv.config();
const logger = createLogger('ai-service');
const PORT = process.env.PORT || 3005;

const startServer = async () => {
  try {
    await rabbitMQService.connect();
    
    app.listen(PORT, () => {
      logger.info(`AI Service is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start AI Service:', error);
    process.exit(1);
  }
};

startServer();

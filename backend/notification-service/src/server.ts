import { app } from './app';
import dotenv from 'dotenv';
import { createLogger } from '@ecoalert/shared';
import { rabbitMQService } from './services/rabbitmq.service';

dotenv.config();
const logger = createLogger('notification-service');
const PORT = process.env.PORT || 3006;

const startServer = async () => {
  try {
    await rabbitMQService.connect();
    
    app.listen(PORT, () => {
      logger.info(`Notification Service is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Notification Service:', error);
    process.exit(1);
  }
};

startServer();

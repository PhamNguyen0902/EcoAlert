import { app } from './app';
import dotenv from 'dotenv';
import { createLogger } from '@ecoalert/shared';
import { rabbitMQService } from './services/rabbitmq.service';
import mongoose from 'mongoose';

dotenv.config();
const logger = createLogger('notification-service');
const PORT = process.env.PORT || 3006;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ecoalert-notification-db';

const startServer = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info('Connected to MongoDB (Notification Service)');
    
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

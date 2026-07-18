import { app } from './app';
import { connectDB } from './config/database.config';
import { envConfig } from './config/env.config';
import { rabbitMQService } from './services/rabbitmq.service';
import { createLogger } from '@ecoalert/shared';

const logger = createLogger('gis-service');

const startServer = async () => {
  try {
    await connectDB();
    await rabbitMQService.connect();
    
    app.listen(envConfig.port, () => {
      logger.info(`GIS Service is running on port ${envConfig.port}`);
    });
  } catch (error) {
    logger.error('Failed to start GIS Service:', error);
    process.exit(1);
  }
};

startServer();

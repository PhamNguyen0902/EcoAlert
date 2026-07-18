import { app } from './app';
import { connectDB } from './config';
import { envConfig } from './config/env.config';
import { createLogger } from '@ecoalert/shared';

const logger = createLogger('user-service');

const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(envConfig.port, () => {
      logger.info(`User Service is running on port ${envConfig.port}`);
    });
  } catch (error) {
    logger.error('Failed to start User Service:', error);
    process.exit(1);
  }
};

startServer();

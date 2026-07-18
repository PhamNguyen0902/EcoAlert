import mongoose from 'mongoose';
import { envConfig } from './env.config';
import { createLogger } from '@ecoalert/shared';

const logger = createLogger('alert-service');

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(envConfig.mongoUri);
    logger.info('Connected to MongoDB (ecoalert-alert-db)');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    throw error;
  }
};

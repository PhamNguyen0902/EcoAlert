import mongoose from 'mongoose';
import { envConfig } from './env.config';
import { createLogger } from '@ecoalert/shared';

const logger = createLogger('gis-service');

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(envConfig.mongoUri);
    logger.info('Connected to MongoDB (ecoalert-gis-db)');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    throw error;
  }
};

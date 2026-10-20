import mongoose from 'mongoose';
import { envConfig } from './env.config';
import { createLogger } from '@ecoalert/shared';
import { Alert } from '../models/alert.model';

const logger = createLogger('alert-service');

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(envConfig.mongoUri);
    await Alert.init(); // Ensure the (citizenId, clientReportId) unique index before accepting retries.
    logger.info('Connected to MongoDB (ecoalert-alert-db)');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    throw error;
  }
};

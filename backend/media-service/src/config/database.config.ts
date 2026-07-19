import mongoose from 'mongoose';
import { createLogger } from '@ecoalert/shared';

const logger = createLogger('media-service');

export const connectDB = async (uri: string) => {
  try {
    await mongoose.connect(uri);
    logger.info('Connected to MongoDB (Media Service)');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

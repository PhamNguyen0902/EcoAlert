import { app } from './app';
import dotenv from 'dotenv';
import { createLogger } from '@ecoalert/shared';
import { connectDB } from './config/database.config';

dotenv.config();
const logger = createLogger('media-service');
const PORT = process.env.PORT || 3003;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ecoalert-media-db';

const start = async () => {
  await connectDB(MONGO_URI);
  app.listen(PORT, () => {
    logger.info(`Media Service is running on port ${PORT}`);
  });
};

start();

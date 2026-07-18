import { app } from './app';
import dotenv from 'dotenv';
import { createLogger } from '@ecoalert/shared';

dotenv.config();
const logger = createLogger('media-service');
const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  logger.info(`Media Service is running on port ${PORT}`);
});

import dotenv from 'dotenv';
dotenv.config();

export const envConfig = {
  port: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/ecoalert-alert-db',
  rabbitMqUrl: process.env.RABBITMQ_URL || 'amqp://localhost',
};

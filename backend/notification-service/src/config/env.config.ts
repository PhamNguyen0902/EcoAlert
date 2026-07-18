import dotenv from 'dotenv';
dotenv.config();

export const envConfig = {
  port: parseInt(process.env.PORT || '3006', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  rabbitMqUrl: process.env.RABBITMQ_URL || 'amqp://localhost',
};

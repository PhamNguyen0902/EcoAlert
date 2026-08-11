import dotenv from 'dotenv';
dotenv.config();

const positiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const envConfig = {
  port: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/ecoalert-alert-db',
  rabbitMqUrl: process.env.RABBITMQ_URL || 'amqp://localhost',
  userServiceUrl: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  officerCheckinRadiusMeters: positiveNumber(process.env.OFFICER_CHECKIN_RADIUS_METERS, 50),
  officerEvidenceRadiusMeters: positiveNumber(process.env.OFFICER_EVIDENCE_RADIUS_METERS, 50),
  officerMaxGpsAccuracyMeters: positiveNumber(process.env.OFFICER_MAX_GPS_ACCURACY_METERS, 100),
  officerWorkloadModerateThreshold: positiveNumber(process.env.OFFICER_WORKLOAD_MODERATE_THRESHOLD, 3),
  officerWorkloadHighThreshold: positiveNumber(process.env.OFFICER_WORKLOAD_HIGH_THRESHOLD, 5),
};

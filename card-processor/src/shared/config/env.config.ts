import { config as loadEnv } from 'dotenv';

loadEnv();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID ?? 'card-processor',
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',')
  }
};

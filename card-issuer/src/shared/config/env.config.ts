import { config as loadEnv } from 'dotenv';

loadEnv();

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: toNumber(process.env.PORT, 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID ?? 'card-issuer',
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',')
  }
};

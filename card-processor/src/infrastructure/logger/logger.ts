import pino from 'pino';

import { env } from '../../shared/config/env.config';

export const logger = pino({
  level: env.logLevel,
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

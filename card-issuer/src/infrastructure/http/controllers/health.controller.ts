import type { Response } from 'express';
import { Controller, Get, Inject, Res } from '@nestjs/common';

import { EVENT_PUBLISHER } from '../../../shared/tokens';
import type { AppPublisher } from '../../../application/ports/event-publisher.port';

@Controller('health')
export class HealthController {
  constructor(@Inject(EVENT_PUBLISHER) private readonly publisher: AppPublisher) {}

  @Get()
  check(@Res({ passthrough: true }) res: Response) {
    const kafkaConnected = this.publisher.isConnected();
    res.status(kafkaConnected ? 200 : 503);

    return {
      status: kafkaConnected ? 'ok' : 'degraded',
      kafka: kafkaConnected ? 'connected' : 'disconnected',
      uptime: process.uptime()
    };
  }
}

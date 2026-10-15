import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { Controller, Get, Inject, Res } from '@nestjs/common';

import { EVENT_PUBLISHER } from '../../../shared/tokens';
import type { AppPublisher } from '../../../application/ports/event-publisher.port';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(EVENT_PUBLISHER) private readonly publisher: AppPublisher,
    private readonly dataSource: DataSource
  ) {}

  @Get()
  check(@Res({ passthrough: true }) res: Response) {
    const kafkaConnected = this.publisher.isConnected();
    const dbConnected = this.dataSource.isInitialized;
    const healthy = kafkaConnected && dbConnected;

    res.status(healthy ? 200 : 503);

    return {
      status: healthy ? 'ok' : 'degraded',
      kafka: kafkaConnected ? 'connected' : 'disconnected',
      database: dbConnected ? 'connected' : 'disconnected',
      uptime: process.uptime()
    };
  }
}

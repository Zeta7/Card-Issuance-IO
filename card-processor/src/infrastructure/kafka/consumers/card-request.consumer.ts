import { Kafka } from 'kafkajs';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { env } from '../../../shared/config/env.config';
import { logger } from '../../logger/logger';
import { TOPICS } from '../../../shared/constants/topics';
import { CardRequestedEvent } from '../../../domain/entities/card-request.event';
import { ProcessCardIssueUseCase } from '../../../application/use-cases/process-card-issue.use-case';

@Injectable()
export class CardRequestConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly kafka = new Kafka({
    clientId: env.kafka.clientId,
    brokers: env.kafka.brokers
  });

  private readonly consumer = this.kafka.consumer({ groupId: 'card-processor-group' });

  constructor(private readonly useCase: ProcessCardIssueUseCase) {}

  async onModuleInit(): Promise<void> {
    await this.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  async start(): Promise<void> {
    await this.consumer.connect();

    await this.consumer.subscribe({
      topic: TOPICS.CARD_REQUESTED,
      fromBeginning: true
    });

    logger.info('Consumer conectado');

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;

        try {
          const payload = JSON.parse(message.value.toString()) as CardRequestedEvent;
          logger.info({ payloadType: payload.type }, '[EVENT RECEIVED]');
          await this.useCase.execute(payload);
        } catch (error) {
          // Un mensaje corrupto no debe tumbar el consumer ni bloquear la partición.
          logger.error({ err: error }, 'No se pudo procesar el evento de solicitud');
        }
      }
    });
  }

  async stop(): Promise<void> {
    await this.consumer.disconnect();
  }
}

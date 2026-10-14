import { Kafka } from 'kafkajs';
import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { env } from '../../../shared/config/env.config';
import { logger } from '../../logger/logger';
import { TOPICS } from '../../../shared/constants/topics';
import { CARD_REPOSITORY } from '../../../shared/tokens';
import type { CardRepository } from '../../../domain/repositories/card.repository';

@Injectable()
export class CardStatusConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly kafka = new Kafka({
    clientId: `${env.kafka.clientId}-status-consumer`,
    brokers: env.kafka.brokers
  });

  private readonly consumer = this.kafka.consumer({
    groupId: 'card-issuer-status-group'
  });

  constructor(@Inject(CARD_REPOSITORY) private readonly repository: CardRepository) {}

  async onModuleInit(): Promise<void> {
    await this.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  async start(): Promise<void> {
    await this.consumer.connect();

    await this.consumer.subscribe({ topic: TOPICS.CARD_ISSUED, fromBeginning: true });
    await this.consumer.subscribe({ topic: TOPICS.CARD_DLQ, fromBeginning: true });

    await this.consumer.run({
      eachMessage: async ({ message, topic }) => {
        if (!message.value) return;

        try {
          const event = JSON.parse(message.value.toString());
          const requestId = event.source;

          if (topic === TOPICS.CARD_ISSUED) {
            await this.repository.updateStatus(requestId, 'ISSUED');
            logger.info({ requestId }, '[STATUS UPDATED] ISSUED');
          }

          if (topic === TOPICS.CARD_DLQ) {
            await this.repository.updateStatus(requestId, 'FAILED');
            logger.info({ requestId }, '[STATUS UPDATED] FAILED');
          }
        } catch (error) {
          // Un mensaje corrupto no debe tumbar el consumer: se registra y se sigue.
          logger.error({ err: error }, 'No se pudo procesar el mensaje de estado');
        }
      }
    });
  }

  async stop(): Promise<void> {
    await this.consumer.disconnect();
  }
}

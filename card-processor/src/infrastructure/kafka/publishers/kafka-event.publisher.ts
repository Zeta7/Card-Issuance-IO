import { Kafka, Producer } from 'kafkajs';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { env } from '../../../shared/config/env.config';
import { logger } from '../../logger/logger';
import { EventPublisherPort } from '../../../application/ports/event-publisher.port';

@Injectable()
export class KafkaEventPublisher implements EventPublisherPort, OnModuleInit, OnModuleDestroy {
  private readonly kafka = new Kafka({
    clientId: env.kafka.clientId,
    brokers: env.kafka.brokers
  });

  private readonly producer: Producer = this.kafka.producer();
  private connected = false;

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    await this.producer.connect();
    this.connected = true;
    logger.info('Productor Kafka conectado');
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async publish(topic: string, message: unknown, key?: string): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ ...(key !== undefined && { key }), value: JSON.stringify(message) }]
    });
  }
}

import { Inject, Injectable, Optional } from '@nestjs/common';

import { TOPICS } from '../../shared/constants/topics';
import { logger } from '../../infrastructure/logger/logger';
import type { EventPublisherPort } from '../ports/event-publisher.port';
import { CloudEventFactory } from '../../shared/events/cloud-event.factory';
import { CardRequestedEvent } from '../../domain/entities/card-request.event';
import { CardGeneratorService } from '../../domain/services/card-generator.service';
import { EVENT_PUBLISHER, RETRY_POLICY } from '../../shared/tokens';
import type { RetryPolicy } from '../../shared/utils/retry-policy';
import { ExponentialBackoffRetryPolicy } from '../../shared/utils/retry-policy';
import { CardIssuanceSimulatorService } from '../../domain/services/card-issuance-simulator.service';

@Injectable()
export class ProcessCardIssueUseCase {
  // Guarda de idempotencia en memoria: si Kafka reentrega un mensaje ya
  // procesado (entrega "at-least-once"), se descarta en vez de emitir dos
  // veces la misma tarjeta. No sobrevive un reinicio del proceso; en
  // producción iría respaldada por Redis/BD con TTL.
  private readonly processedAttempts = new Set<string>();

  constructor(
    private readonly simulator: CardIssuanceSimulatorService,
    private readonly generator: CardGeneratorService,
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisherPort,
    @Optional()
    @Inject(RETRY_POLICY)
    private readonly retryPolicy: RetryPolicy = new ExponentialBackoffRetryPolicy()
  ) {}

  async execute(event: CardRequestedEvent): Promise<void> {
    const attemptKey = `${event.source}:${event.data.retryCount}`;

    if (this.processedAttempts.has(attemptKey)) {
      logger.warn({ requestId: event.data.requestId }, '[SKIP] Evento duplicado, ya procesado');
      return;
    }

    this.processedAttempts.add(attemptKey);

    try {
      await this.simulator.process(event.data.forceError);

      const card = this.generator.generate(
        event.data.customer.fullName,
        event.data.product.currency
      );

      const issuedEvent = CloudEventFactory.create(TOPICS.CARD_ISSUED, event.source, {
        requestId: event.data.requestId,
        customer: event.data.customer,
        product: event.data.product,
        card,
        status: 'ISSUED'
      });

      await this.publisher.publish(TOPICS.CARD_ISSUED, issuedEvent, event.source);

      logger.info({ requestId: event.data.requestId }, '[SUCCESS] Tarjeta emitida');
    } catch (error) {
      await this.handleFailure(event, error as Error);
    }
  }

  private async handleFailure(event: CardRequestedEvent, error: Error): Promise<void> {
    const retryCount = event.data.retryCount + 1;

    logger.error(
      { requestId: event.data.requestId, retryCount, err: error },
      '[ERROR] Fallo al emitir tarjeta'
    );

    if (retryCount <= this.retryPolicy.maxAttempts) {
      const retryEvent = { ...event, data: { ...event.data, retryCount } };

      // El backoff se agenda con setTimeout en vez de bloquear eachMessage
      // con un await: Kafka puede confirmar el offset del mensaje actual y
      // seguir leyendo la partición mientras el reintento espera su turno.
      setTimeout(() => {
        this.publisher
          .publish(TOPICS.CARD_REQUESTED, retryEvent, event.source)
          .catch(publishError => {
            logger.error({ err: publishError }, '[ERROR] No se pudo reencolar el reintento');
          });
      }, this.retryPolicy.delayFor(retryCount));

      logger.info({ requestId: event.data.requestId, retryCount }, '[RETRY] Reintento agendado');
      return;
    }

    const dlqEvent = CloudEventFactory.create(TOPICS.CARD_DLQ, event.source, {
      reason: error.message,
      attempts: retryCount,
      originalPayload: event
    });

    await this.publisher.publish(TOPICS.CARD_DLQ, dlqEvent, event.source);
    logger.error({ requestId: event.data.requestId }, '[DLQ] Mensaje enviado a DLQ');
  }
}

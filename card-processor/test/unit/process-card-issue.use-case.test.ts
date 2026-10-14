import { TOPICS } from '../../src/shared/constants/topics';
import { EventPublisherPort } from '../../src/application/ports/event-publisher.port';
import { ProcessCardIssueUseCase } from '../../src/application/use-cases/process-card-issue.use-case';
import { CardRequestedEvent } from '../../src/domain/entities/card-request.event';
import { CardGeneratorService } from '../../src/domain/services/card-generator.service';
import { RetryPolicy } from '../../src/shared/utils/retry-policy';
import { CardIssuanceSimulatorService } from '../../src/domain/services/card-issuance-simulator.service';

interface PublishedMessage {
  topic: string;
  message:
    CardRequestedEvent | { data: { reason: string; attempts: number; originalPayload: unknown } };
  key?: string;
}

class FakeEventPublisher implements EventPublisherPort {
  readonly published: PublishedMessage[] = [];

  async publish(topic: string, message: unknown, key?: string): Promise<void> {
    this.published.push({
      topic,
      message: message as PublishedMessage['message'],
      ...(key !== undefined && { key })
    });
  }
}

// Política de prueba: mismo máximo de intentos que la real, pero sin delays,
// para no depender de temporizadores reales en el test.
class InstantRetryPolicy implements RetryPolicy {
  readonly maxAttempts = 3;
  delayFor(): number {
    return 0;
  }
  async wait(): Promise<void> {}
}

const buildEvent = (overrides: Partial<CardRequestedEvent['data']> = {}): CardRequestedEvent => ({
  id: 1,
  source: 'request-1',
  type: TOPICS.CARD_REQUESTED,
  time: new Date().toISOString(),
  data: {
    requestId: 'request-1',
    customer: {
      documentType: 'DNI',
      documentNumber: '73425419',
      fullName: 'Edson Meza',
      age: 25,
      email: 'edson@gmail.com'
    },
    product: { type: 'VISA', currency: 'PEN' },
    retryCount: 0,
    status: 'PENDING',
    ...overrides
  }
});

describe('ProcessCardIssueUseCase', () => {
  it('publica io.cards.issued.v1 cuando la simulación es exitosa', async () => {
    const publisher = new FakeEventPublisher();
    const simulator = {
      process: jest.fn().mockResolvedValue(undefined)
    } as unknown as CardIssuanceSimulatorService;
    const generator = new CardGeneratorService();

    const useCase = new ProcessCardIssueUseCase(
      simulator,
      generator,
      publisher,
      new InstantRetryPolicy()
    );
    await useCase.execute(buildEvent());

    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.topic).toBe(TOPICS.CARD_ISSUED);
    expect(publisher.published[0]?.key).toBe('request-1');
  });

  it('agota los 3 reintentos y termina publicando en la DLQ con la razón y los intentos', async () => {
    jest.useFakeTimers();

    const publisher = new FakeEventPublisher();
    const simulator = {
      process: jest.fn().mockRejectedValue(new Error('Fallo en la emisión forzada'))
    } as unknown as CardIssuanceSimulatorService;
    const generator = new CardGeneratorService();

    const useCase = new ProcessCardIssueUseCase(
      simulator,
      generator,
      publisher,
      new InstantRetryPolicy()
    );

    let event = buildEvent({ forceError: true });

    // Cada intento fallido vuelve a publicar en CARD_REQUESTED con retryCount+1;
    // simulamos el re-consumo encadenando execute() con el evento republicado.
    for (let attempt = 0; attempt < 4; attempt++) {
      await useCase.execute(event);
      await jest.runAllTimersAsync();

      const lastRequested = [...publisher.published]
        .reverse()
        .find(p => p.topic === TOPICS.CARD_REQUESTED);
      if (lastRequested) event = lastRequested.message as CardRequestedEvent;
    }

    const dlqMessage = publisher.published.find(p => p.topic === TOPICS.CARD_DLQ);
    const dlqData = dlqMessage?.message.data as { reason: string; attempts: number } | undefined;

    expect(dlqData).toBeDefined();
    expect(dlqData?.attempts).toBe(4);
    expect(dlqData?.reason).toBe('Fallo en la emisión forzada');

    jest.useRealTimers();
  });

  it('no procesa dos veces el mismo intento si el evento llega duplicado', async () => {
    const publisher = new FakeEventPublisher();
    const simulator = {
      process: jest.fn().mockResolvedValue(undefined)
    } as unknown as CardIssuanceSimulatorService;
    const generator = new CardGeneratorService();

    const useCase = new ProcessCardIssueUseCase(
      simulator,
      generator,
      publisher,
      new InstantRetryPolicy()
    );

    const event = buildEvent();
    await useCase.execute(event);
    await useCase.execute(event);

    expect(simulator.process).toHaveBeenCalledTimes(1);
    expect(publisher.published).toHaveLength(1);
  });
});

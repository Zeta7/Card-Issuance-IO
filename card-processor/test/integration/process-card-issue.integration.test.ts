import { TOPICS } from '../../src/shared/constants/topics';
import { EventPublisherPort } from '../../src/application/ports/event-publisher.port';
import { ProcessCardIssueUseCase } from '../../src/application/use-cases/process-card-issue.use-case';
import { CardRequestedEvent } from '../../src/domain/entities/card-request.event';
import { CardGeneratorService } from '../../src/domain/services/card-generator.service';
import { ExponentialBackoffRetryPolicy } from '../../src/shared/utils/retry-policy';
import { CardIssuanceSimulatorService } from '../../src/domain/services/card-issuance-simulator.service';

// Integra los colaboradores reales (simulador, generador de tarjetas y la
// política de reintentos real, con sus delays reales) y solo sustituye el
// publisher de Kafka, que es el límite con el sistema externo.
interface PublishedMessage {
  topic: string;
  message: unknown;
  key?: string;
}

class FakeEventPublisher implements EventPublisherPort {
  readonly published: PublishedMessage[] = [];

  async publish(topic: string, message: unknown, key?: string): Promise<void> {
    this.published.push({ topic, message, ...(key !== undefined && { key }) });
  }
}

interface IssuedEventData {
  data: { card: { cardNumber: string; status: string } };
}

interface DlqEventData {
  data: { attempts: number; reason: string; originalPayload: { source: string } };
}

const buildEvent = (overrides: Partial<CardRequestedEvent['data']> = {}): CardRequestedEvent => ({
  id: 1,
  source: 'request-integration',
  type: TOPICS.CARD_REQUESTED,
  time: new Date().toISOString(),
  data: {
    requestId: 'request-integration',
    customer: {
      documentType: 'DNI',
      documentNumber: '11654321',
      fullName: 'Jose Perez',
      age: 30,
      email: 'joseperez@example.com'
    },
    product: { type: 'VISA', currency: 'USD' },
    retryCount: 0,
    status: 'PENDING',
    ...overrides
  }
});

describe('ProcessCardIssueUseCase (integración)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('emite una tarjeta real (Luhn válido) cuando el azar favorece el éxito', async () => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.99);

    const publisher = new FakeEventPublisher();
    const useCase = new ProcessCardIssueUseCase(
      new CardIssuanceSimulatorService(),
      new CardGeneratorService(),
      publisher
    );

    const executePromise = useCase.execute(buildEvent());
    await jest.advanceTimersByTimeAsync(500);
    await executePromise;

    expect(publisher.published).toHaveLength(1);
    const issued = publisher.published[0];
    const issuedData = (issued?.message as IssuedEventData).data;

    expect(issued?.topic).toBe(TOPICS.CARD_ISSUED);
    expect(issuedData.card.cardNumber).toHaveLength(16);
    expect(issuedData.card.status).toBe('ISSUED');
  });

  it('con la política de reintentos real agota los 3 intentos (1s/2s/4s) y termina en la DLQ', async () => {
    jest.useFakeTimers();

    const publisher = new FakeEventPublisher();
    const useCase = new ProcessCardIssueUseCase(
      new CardIssuanceSimulatorService(),
      new CardGeneratorService(),
      publisher,
      new ExponentialBackoffRetryPolicy()
    );

    let event = buildEvent({ forceError: true });

    for (let attempt = 0; attempt < 4; attempt++) {
      // No se espera la promesa antes de avanzar el reloj: el simulador y el
      // backoff usan setTimeout internamente, así que hay que dejar correr
      // los timers falsos para que esas esperas (hasta 500ms + hasta 4s)
      // se resuelvan antes de poder esperar el resultado.
      const executePromise = useCase.execute(event);
      await jest.advanceTimersByTimeAsync(5000);
      await executePromise;

      const lastRequested = [...publisher.published]
        .reverse()
        .find(p => p.topic === TOPICS.CARD_REQUESTED);
      if (lastRequested) event = lastRequested.message as CardRequestedEvent;
    }

    const dlqMessage = publisher.published.find(p => p.topic === TOPICS.CARD_DLQ);
    const dlqData = (dlqMessage?.message as DlqEventData | undefined)?.data;

    expect(dlqData?.attempts).toBe(4);
    expect(dlqData?.originalPayload.source).toBe('request-integration');
  }, 10_000);
});

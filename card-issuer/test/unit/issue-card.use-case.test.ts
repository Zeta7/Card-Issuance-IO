import { TOPICS } from '../../src/shared/constants/topics';
import { IssueCardUseCase } from '../../src/application/use-cases/issue-card.use-case';
import { EventPublisherPort } from '../../src/application/ports/event-publisher.port';
import { DuplicateCardRequestError } from '../../src/shared/errors/domain.error';
import { InMemoryCardRepository } from '../../src/infrastructure/persistence/repositories/in-memory-card.repository';

class FakeEventPublisher implements EventPublisherPort {
  readonly published: { topic: string; message: unknown; key?: string }[] = [];

  async publish(topic: string, message: unknown, key?: string): Promise<void> {
    this.published.push({ topic, message, ...(key !== undefined && { key }) });
  }
}

const buildPayload = (documentNumber = '73425419') => ({
  customer: {
    documentType: 'DNI' as const,
    documentNumber,
    fullName: 'Edson Meza',
    age: 25,
    email: 'edson@gmail.com'
  },
  product: { type: 'VISA' as const, currency: 'PEN' as const },
  forceError: false
});

describe('IssueCardUseCase', () => {
  it('crea la solicitud, la guarda como PENDING y publica el evento de requested', async () => {
    const repository = new InMemoryCardRepository();
    const publisher = new FakeEventPublisher();
    const useCase = new IssueCardUseCase(repository, publisher);

    const result = await useCase.execute(buildPayload());

    expect(result.status).toBe('PENDING');
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.topic).toBe(TOPICS.CARD_REQUESTED);
    expect(publisher.published[0]?.key).toBe(result.requestId);

    const stored = await repository.findAll();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.status).toBe('PENDING');
  });

  it('rechaza una segunda solicitud para el mismo documento mientras la primera sigue activa', async () => {
    const repository = new InMemoryCardRepository();
    const publisher = new FakeEventPublisher();
    const useCase = new IssueCardUseCase(repository, publisher);

    await useCase.execute(buildPayload('73425419'));

    await expect(useCase.execute(buildPayload('73425419'))).rejects.toBeInstanceOf(
      DuplicateCardRequestError
    );
  });

  it('permite volver a solicitar tarjeta si la solicitud anterior del mismo documento terminó en FAILED', async () => {
    const repository = new InMemoryCardRepository();
    const publisher = new FakeEventPublisher();
    const useCase = new IssueCardUseCase(repository, publisher);

    const first = await useCase.execute(buildPayload('73425419'));
    await repository.updateStatus(first.requestId, 'FAILED');

    const second = await useCase.execute(buildPayload('73425419'));

    expect(second.requestId).not.toBe(first.requestId);
    const all = await repository.findAll();
    expect(all).toHaveLength(2);
  });
});

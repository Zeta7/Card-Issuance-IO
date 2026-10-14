import { GetCardsUseCase } from '../../src/application/use-cases/get-cards.use-case';
import { InMemoryCardRepository } from '../../src/infrastructure/persistence/repositories/in-memory-card.repository';
import { CardRequestEntity } from '../../src/domain/entities/card-request.entity';

const buildEntity = (requestId: string): CardRequestEntity => ({
  requestId,
  customer: {
    documentType: 'DNI',
    documentNumber: '73425419',
    fullName: 'Edson Meza',
    age: 25,
    email: 'edson@gmail.com'
  },
  product: { type: 'VISA', currency: 'PEN' },
  status: 'PENDING',
  createdAt: new Date()
});

describe('GetCardsUseCase', () => {
  it('devuelve vacío cuando no hay solicitudes', async () => {
    const useCase = new GetCardsUseCase(new InMemoryCardRepository());
    expect(await useCase.execute()).toEqual([]);
  });

  it('devuelve todas las solicitudes guardadas en el repositorio', async () => {
    const repository = new InMemoryCardRepository();
    await repository.reserve(buildEntity('req-1'));

    const useCase = new GetCardsUseCase(repository);
    const result = await useCase.execute();

    expect(result).toHaveLength(1);
    expect(result[0]?.requestId).toBe('req-1');
  });
});

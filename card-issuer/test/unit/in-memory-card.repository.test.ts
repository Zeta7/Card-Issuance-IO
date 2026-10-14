import { InMemoryCardRepository } from '../../src/infrastructure/persistence/repositories/in-memory-card.repository';
import { CardRequestEntity } from '../../src/domain/entities/card-request.entity';

const buildEntity = (requestId: string, documentNumber = '73425419'): CardRequestEntity => ({
  requestId,
  customer: {
    documentType: 'DNI',
    documentNumber,
    fullName: 'Edson Meza',
    age: 25,
    email: 'edson@gmail.com'
  },
  product: { type: 'VISA', currency: 'PEN' },
  status: 'PENDING',
  createdAt: new Date()
});

describe('InMemoryCardRepository.reserve', () => {
  it('solo una de dos reservas concurrentes para el mismo documento se queda con el cupo', async () => {
    const repository = new InMemoryCardRepository();

    const [first, second] = await Promise.all([
      repository.reserve(buildEntity('req-1')),
      repository.reserve(buildEntity('req-2'))
    ]);

    const reservedCount = [first, second].filter(result => result.reserved).length;
    expect(reservedCount).toBe(1);

    const all = await repository.findAll();
    expect(all).toHaveLength(1);
  });

  it('no bloquea permanentemente a un cliente cuya solicitud anterior quedó FAILED', async () => {
    const repository = new InMemoryCardRepository();

    const first = await repository.reserve(buildEntity('req-1'));
    expect(first.reserved).toBe(true);

    await repository.updateStatus('req-1', 'FAILED');

    const second = await repository.reserve(buildEntity('req-2'));
    expect(second.reserved).toBe(true);
  });

  it('findAll devuelve una copia y no la referencia interna', async () => {
    const repository = new InMemoryCardRepository();
    await repository.reserve(buildEntity('req-1'));

    const all = await repository.findAll();
    all.pop();

    expect(await repository.findAll()).toHaveLength(1);
  });

  it('updateStatus no hace nada si el requestId no existe', async () => {
    const repository = new InMemoryCardRepository();
    await repository.reserve(buildEntity('req-1'));

    await repository.updateStatus('no-existe', 'ISSUED');

    const all = await repository.findAll();
    expect(all[0]?.status).toBe('PENDING');
  });
});

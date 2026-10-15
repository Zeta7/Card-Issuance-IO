import { Repository } from 'typeorm';

import { PostgresCardRepository } from '../../src/infrastructure/persistence/repositories/postgres-card.repository';
import { CardRequestOrmEntity } from '../../src/infrastructure/persistence/entities/card-request.orm-entity';
import { CardRequestEntity } from '../../src/domain/entities/card-request.entity';

type MockRepo = jest.Mocked<
  Pick<Repository<CardRequestOrmEntity>, 'insert' | 'findOne' | 'find' | 'update'>
>;

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
  createdAt: new Date('2026-01-01T00:00:00.000Z')
});

const buildRow = (entity: CardRequestEntity): CardRequestOrmEntity => {
  const row = new CardRequestOrmEntity();
  row.requestId = entity.requestId;
  row.documentNumber = entity.customer.documentNumber;
  row.customer = entity.customer;
  row.product = entity.product;
  row.forceError = entity.forceError ?? null;
  row.status = entity.status;
  row.createdAt = entity.createdAt;
  return row;
};

describe('PostgresCardRepository', () => {
  let repo: MockRepo;
  let repository: PostgresCardRepository;

  beforeEach(() => {
    repo = {
      insert: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn()
    };
    repository = new PostgresCardRepository(repo as unknown as Repository<CardRequestOrmEntity>);
  });

  it('reserve(): inserta y devuelve reserved true cuando no hay conflicto', async () => {
    repo.insert.mockResolvedValue({} as never);

    const result = await repository.reserve(buildEntity('req-1'));

    expect(result).toEqual({ reserved: true });
    expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-1' }));
  });

  it('reserve(): ante una violación de unicidad (23505) devuelve reserved false y la solicitud existente', async () => {
    const existingEntity = buildEntity('req-0');
    repo.insert.mockRejectedValue({ code: '23505' });
    repo.findOne.mockResolvedValue(buildRow(existingEntity));

    const result = await repository.reserve(buildEntity('req-1'));

    expect(result.reserved).toBe(false);
    expect(result.existing?.requestId).toBe('req-0');
  });

  it('reserve(): relanza cualquier otro error que no sea una violación de unicidad', async () => {
    repo.insert.mockRejectedValue(new Error('conexión perdida'));

    await expect(repository.reserve(buildEntity('req-1'))).rejects.toThrow('conexión perdida');
  });

  it('findAll(): mapea las filas a entidades de dominio', async () => {
    repo.find.mockResolvedValue([buildRow(buildEntity('req-1'))]);

    const result = await repository.findAll();

    expect(result).toHaveLength(1);
    expect(result[0]?.requestId).toBe('req-1');
    expect(result[0]?.customer.documentNumber).toBe('73425419');
  });

  it('updateStatus(): delega en el update del repositorio de TypeORM', async () => {
    repo.update.mockResolvedValue({} as never);

    await repository.updateStatus('req-1', 'ISSUED');

    expect(repo.update).toHaveBeenCalledWith({ requestId: 'req-1' }, { status: 'ISSUED' });
  });
});

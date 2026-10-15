import request from 'supertest';
import { DataSource } from 'typeorm';
import { Test } from '@nestjs/testing';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { INestApplication } from '@nestjs/common';

import { CARD_REPOSITORY, EVENT_PUBLISHER } from '../../src/shared/tokens';
import type { EventPublisherPort } from '../../src/application/ports/event-publisher.port';
import { IssueCardUseCase } from '../../src/application/use-cases/issue-card.use-case';
import { GetCardsUseCase } from '../../src/application/use-cases/get-cards.use-case';
import { CardController } from '../../src/infrastructure/http/controllers/card.controller';
import { HealthController } from '../../src/infrastructure/http/controllers/health.controller';
import { DomainErrorFilter } from '../../src/infrastructure/http/filters/domain-error.filter';
import { InMemoryCardRepository } from '../../src/infrastructure/persistence/repositories/in-memory-card.repository';

// La API se prueba de punta a punta (HTTP -> pipe de validación -> caso de
// uso -> repositorio -> filtro de errores) armando un módulo de Nest
// equivalente al AppModule real, pero sin TypeOrmModule/KafkaEventPublisher:
// ambos abren una conexión real apenas el módulo se inicializa, así que no
// hay forma de "sobreescribirlos" después sin tocar una base/un broker de
// verdad. En su lugar, se inyecta un repositorio en memoria real (el mismo
// InMemoryCardRepository, no un mock) y un publisher fake.
class FakePublisher implements EventPublisherPort {
  readonly published: { topic: string; message: unknown; key?: string }[] = [];
  isConnectedValue = true;

  async publish(topic: string, message: unknown, key?: string): Promise<void> {
    this.published.push({ topic, message, ...(key !== undefined && { key }) });
  }

  isConnected(): boolean {
    return this.isConnectedValue;
  }
}

const buildPayload = (documentNumber = '11654321') => ({
  customer: {
    documentType: 'DNI',
    documentNumber,
    fullName: 'Jose Perez',
    age: 25,
    email: 'joseperez@example.com'
  },
  product: { type: 'VISA', currency: 'PEN' }
});

describe('card-issuer API', () => {
  let app: INestApplication;
  let publisher: FakePublisher;

  const buildApp = async () => {
    publisher = new FakePublisher();

    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 20 }] })],
      controllers: [CardController, HealthController],
      providers: [
        IssueCardUseCase,
        GetCardsUseCase,
        { provide: CARD_REPOSITORY, useClass: InMemoryCardRepository },
        { provide: EVENT_PUBLISHER, useValue: publisher },
        { provide: DataSource, useValue: { isInitialized: true } },
        { provide: APP_FILTER, useClass: DomainErrorFilter }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    return app;
  };

  afterEach(async () => {
    await app?.close();
  });

  it('POST /cards/issue acepta una solicitud válida y responde 202', async () => {
    await buildApp();

    const response = await request(app.getHttpServer()).post('/cards/issue').send(buildPayload());

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({ status: 'PENDING' });
    expect(response.body.requestId).toBeDefined();
  });

  it('POST /cards/issue responde 400 con un payload inválido', async () => {
    await buildApp();

    const response = await request(app.getHttpServer())
      .post('/cards/issue')
      .send({ customer: { documentType: 'DNI' } });

    expect(response.status).toBe(400);
    expect(response.body.message).toBeDefined();
  });

  it('POST /cards/issue responde 409 si el cliente ya tiene una solicitud activa', async () => {
    await buildApp();

    await request(app.getHttpServer()).post('/cards/issue').send(buildPayload('11654321'));
    const response = await request(app.getHttpServer())
      .post('/cards/issue')
      .send(buildPayload('11654321'));

    expect(response.status).toBe(409);
  });

  it('GET /cards/all devuelve las solicitudes creadas', async () => {
    await buildApp();

    await request(app.getHttpServer()).post('/cards/issue').send(buildPayload('73425419'));
    const response = await request(app.getHttpServer()).get('/cards/all');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  it('GET /health responde ok cuando el publisher y la base están conectados', async () => {
    await buildApp();

    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('connected');
  });

  it('GET /health responde degraded cuando el publisher no está conectado', async () => {
    await buildApp();
    publisher.isConnectedValue = false;

    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('degraded');
  });
});

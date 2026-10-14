import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';

import { AppModule } from '../../src/app.module';
import { EVENT_PUBLISHER } from '../../src/shared/tokens';
import type { EventPublisherPort } from '../../src/application/ports/event-publisher.port';
import { CardStatusConsumer } from '../../src/infrastructure/kafka/consumers/card-status.consumer';

// La API se prueba de punta a punta (HTTP -> pipe de validación -> caso de
// uso -> repositorio -> filtro de errores) levantando el AppModule real de
// Nest y sustituyendo solo lo que toca un sistema externo: el publisher de
// Kafka y el consumer de estados (si no, Nest intentaría conectarse a un
// Kafka real al llamar app.init()).
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

const noopConsumer = { onModuleInit: jest.fn(), onModuleDestroy: jest.fn() };

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

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EVENT_PUBLISHER)
      .useValue(publisher)
      .overrideProvider(CardStatusConsumer)
      .useValue(noopConsumer)
      .compile();

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

  it('GET /health responde ok cuando el publisher está conectado', async () => {
    await buildApp();

    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('GET /health responde degraded cuando el publisher no está conectado', async () => {
    await buildApp();
    publisher.isConnectedValue = false;

    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('degraded');
  });
});

import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module';
import { EVENT_PUBLISHER } from '../../src/shared/tokens';
import { ProcessCardIssueUseCase } from '../../src/application/use-cases/process-card-issue.use-case';
import { CardRequestConsumer } from '../../src/infrastructure/kafka/consumers/card-request.consumer';

// Valida que el AppModule real de Nest resuelva todo el grafo de
// dependencias (useCase <- simulador/generador/publisher/retryPolicy,
// consumer <- useCase) sin levantar una conexión real a Kafka.
describe('AppModule', () => {
  it('resuelve ProcessCardIssueUseCase y CardRequestConsumer con sus dependencias', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EVENT_PUBLISHER)
      .useValue({ publish: jest.fn(), isConnected: () => true })
      .overrideProvider(CardRequestConsumer)
      .useValue({ onModuleInit: jest.fn(), onModuleDestroy: jest.fn() })
      .compile();

    await moduleRef.init();

    const useCase = moduleRef.get(ProcessCardIssueUseCase);
    expect(useCase).toBeInstanceOf(ProcessCardIssueUseCase);

    await moduleRef.close();
  });
});

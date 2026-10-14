import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { CARD_REPOSITORY, EVENT_PUBLISHER } from './shared/tokens';
import { IssueCardUseCase } from './application/use-cases/issue-card.use-case';
import { GetCardsUseCase } from './application/use-cases/get-cards.use-case';
import { CardController } from './infrastructure/http/controllers/card.controller';
import { HealthController } from './infrastructure/http/controllers/health.controller';
import { DomainErrorFilter } from './infrastructure/http/filters/domain-error.filter';
import { requestIdMiddleware } from './infrastructure/http/middlewares/request-id.middleware';
import { CardStatusConsumer } from './infrastructure/kafka/consumers/card-status.consumer';
import { KafkaEventPublisher } from './infrastructure/kafka/producers/kafka-event.publisher';
import { InMemoryCardRepository } from './infrastructure/persistence/repositories/in-memory-card.repository';

@Module({
  imports: [ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 20 }] })],
  controllers: [CardController, HealthController],
  providers: [
    IssueCardUseCase,
    GetCardsUseCase,
    CardStatusConsumer,
    { provide: CARD_REPOSITORY, useClass: InMemoryCardRepository },
    { provide: EVENT_PUBLISHER, useClass: KafkaEventPublisher },
    // Registrado como APP_FILTER (no con app.useGlobalFilters en main.ts) para
    // que también esté activo en los tests de integración, que levantan el
    // AppModule a través de Test.createTestingModule sin pasar por main.ts.
    { provide: APP_FILTER, useClass: DomainErrorFilter }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware).forRoutes('*');
  }
}

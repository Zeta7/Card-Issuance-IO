import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';

import { env } from './shared/config/env.config';
import { CARD_REPOSITORY, EVENT_PUBLISHER } from './shared/tokens';
import { IssueCardUseCase } from './application/use-cases/issue-card.use-case';
import { GetCardsUseCase } from './application/use-cases/get-cards.use-case';
import { CardController } from './infrastructure/http/controllers/card.controller';
import { HealthController } from './infrastructure/http/controllers/health.controller';
import { DomainErrorFilter } from './infrastructure/http/filters/domain-error.filter';
import { requestIdMiddleware } from './infrastructure/http/middlewares/request-id.middleware';
import { CardStatusConsumer } from './infrastructure/kafka/consumers/card-status.consumer';
import { KafkaEventPublisher } from './infrastructure/kafka/producers/kafka-event.publisher';
import { CardRequestOrmEntity } from './infrastructure/persistence/entities/card-request.orm-entity';
import { PostgresCardRepository } from './infrastructure/persistence/repositories/postgres-card.repository';

@Module({
  imports: [
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 20 }] }),
    // synchronize:true crea el esquema automáticamente a partir de las
    // entidades; para un reto técnico evita sumar un runner de migraciones.
    // En un proyecto real usaría migraciones versionadas en vez de esto.
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: env.db.host,
      port: env.db.port,
      username: env.db.user,
      password: env.db.password,
      database: env.db.name,
      entities: [CardRequestOrmEntity],
      synchronize: true
    }),
    TypeOrmModule.forFeature([CardRequestOrmEntity])
  ],
  controllers: [CardController, HealthController],
  providers: [
    IssueCardUseCase,
    GetCardsUseCase,
    CardStatusConsumer,
    { provide: CARD_REPOSITORY, useClass: PostgresCardRepository },
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

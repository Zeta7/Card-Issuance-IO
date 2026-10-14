import { Module } from '@nestjs/common';

import { EVENT_PUBLISHER, RETRY_POLICY } from './shared/tokens';
import { CardGeneratorService } from './domain/services/card-generator.service';
import { ExponentialBackoffRetryPolicy } from './shared/utils/retry-policy';
import { CardRequestConsumer } from './infrastructure/kafka/consumers/card-request.consumer';
import { KafkaEventPublisher } from './infrastructure/kafka/publishers/kafka-event.publisher';
import { ProcessCardIssueUseCase } from './application/use-cases/process-card-issue.use-case';
import { CardIssuanceSimulatorService } from './domain/services/card-issuance-simulator.service';

@Module({
  providers: [
    CardGeneratorService,
    CardIssuanceSimulatorService,
    ProcessCardIssueUseCase,
    CardRequestConsumer,
    { provide: EVENT_PUBLISHER, useClass: KafkaEventPublisher },
    { provide: RETRY_POLICY, useClass: ExponentialBackoffRetryPolicy }
  ]
})
export class AppModule {}

import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

import { IssueCardDto } from '../dto/issue-card.dto';
import { TOPICS } from '../../shared/constants/topics';
import type { EventPublisherPort } from '../ports/event-publisher.port';
import type { CardRepository } from '../../domain/repositories/card.repository';
import { CardRequestEntity } from '../../domain/entities/card-request.entity';
import { CloudEventFactory } from '../../shared/events/cloud-event.factory';
import { DuplicateCardRequestError } from '../../shared/errors/domain.error';
import { CARD_REPOSITORY, EVENT_PUBLISHER } from '../../shared/tokens';

@Injectable()
export class IssueCardUseCase {
  constructor(
    @Inject(CARD_REPOSITORY) private readonly repository: CardRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherPort
  ) {}

  async execute(payload: IssueCardDto) {
    const requestId = uuid();

    const entity: CardRequestEntity = {
      requestId,
      customer: payload.customer,
      product: payload.product,
      forceError: payload.forceError,
      status: 'PENDING',
      createdAt: new Date()
    };

    const { reserved } = await this.repository.reserve(entity);
    if (!reserved) throw new DuplicateCardRequestError(payload.customer.documentNumber);

    const event = CloudEventFactory.create(TOPICS.CARD_REQUESTED, requestId, {
      ...entity,
      retryCount: 0
    });

    await this.eventPublisher.publish(TOPICS.CARD_REQUESTED, event, requestId);

    return { requestId, status: entity.status };
  }
}

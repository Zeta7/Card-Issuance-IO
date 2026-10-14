import { Inject, Injectable } from '@nestjs/common';

import type { CardRepository } from '../../domain/repositories/card.repository';
import { CARD_REPOSITORY } from '../../shared/tokens';

@Injectable()
export class GetCardsUseCase {
  constructor(@Inject(CARD_REPOSITORY) private readonly repository: CardRepository) {}

  async execute() {
    return this.repository.findAll();
  }
}

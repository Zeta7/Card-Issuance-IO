import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

import { type IssueCardDto, issueCardSchema } from '../../../application/dto/issue-card.dto';
import { IssueCardUseCase } from '../../../application/use-cases/issue-card.use-case';
import { GetCardsUseCase } from '../../../application/use-cases/get-cards.use-case';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

@Controller('cards')
export class CardController {
  constructor(
    private readonly issueCardUseCase: IssueCardUseCase,
    private readonly getCardsUseCase: GetCardsUseCase
  ) {}

  // Límite básico para el endpoint de escritura: mitiga abuso/fuerza bruta
  // sobre la emisión de tarjetas sin complicar el resto de la API.
  @Post('issue')
  @HttpCode(202)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async issue(@Body(new ZodValidationPipe(issueCardSchema)) payload: IssueCardDto) {
    return this.issueCardUseCase.execute(payload);
  }

  @Get('all')
  async findAll() {
    return this.getCardsUseCase.execute();
  }
}

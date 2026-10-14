import { Injectable } from '@nestjs/common';

import { CardRepository, ReserveResult } from '../../../domain/repositories/card.repository';
import { CardRequestEntity } from '../../../domain/entities/card-request.entity';

@Injectable()
export class InMemoryCardRepository implements CardRepository {
  private readonly cards: CardRequestEntity[] = [];

  // "reserve" hace el chequeo y la inserción en una sola operación síncrona
  // (sin await de por medio) para que dos solicitudes concurrentes del mismo
  // documento no puedan intercalarse entre el "existe?" y el "guardar": así se
  // cierra la condición de carrera que tenía el find+save por separado.
  // Una solicitud FAILED no bloquea al cliente: puede volver a intentarlo.
  async reserve(card: CardRequestEntity): Promise<ReserveResult> {
    const existing = this.cards.find(
      item =>
        item.customer.documentNumber === card.customer.documentNumber && item.status !== 'FAILED'
    );

    if (existing) return { reserved: false, existing };

    this.cards.push(card);
    return { reserved: true };
  }

  async findAll(): Promise<CardRequestEntity[]> {
    return [...this.cards];
  }

  async updateStatus(requestId: string, status: 'PENDING' | 'ISSUED' | 'FAILED'): Promise<void> {
    const card = this.cards.find(item => item.requestId === requestId);
    if (!card) return;
    card.status = status;
  }
}

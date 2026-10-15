import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';

import { CardRequestOrmEntity } from '../entities/card-request.orm-entity';
import { CardRepository, ReserveResult } from '../../../domain/repositories/card.repository';
import { CardRequestEntity } from '../../../domain/entities/card-request.entity';

const POSTGRES_UNIQUE_VIOLATION = '23505';

// Reemplaza la reserva atómica en memoria (InMemoryCardRepository) por un
// índice único parcial en Postgres (ver CardRequestOrmEntity): con más de una
// instancia del servicio corriendo, la única fuente de verdad que puede
// arbitrar la carrera entre dos inserts concurrentes es la base de datos.
@Injectable()
export class PostgresCardRepository implements CardRepository {
  constructor(
    @InjectRepository(CardRequestOrmEntity)
    private readonly repo: Repository<CardRequestOrmEntity>
  ) {}

  async reserve(card: CardRequestEntity): Promise<ReserveResult> {
    try {
      await this.repo.insert(this.toRow(card));
      return { reserved: true };
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;

      const existing = await this.repo.findOne({
        where: { documentNumber: card.customer.documentNumber },
        order: { createdAt: 'DESC' }
      });

      return { reserved: false, ...(existing && { existing: this.toDomain(existing) }) };
    }
  }

  async findAll(): Promise<CardRequestEntity[]> {
    const rows = await this.repo.find({ order: { createdAt: 'ASC' } });
    return rows.map(row => this.toDomain(row));
  }

  async updateStatus(requestId: string, status: 'PENDING' | 'ISSUED' | 'FAILED'): Promise<void> {
    await this.repo.update({ requestId }, { status });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
    );
  }

  private toRow(card: CardRequestEntity): CardRequestOrmEntity {
    const row = new CardRequestOrmEntity();
    row.requestId = card.requestId;
    row.documentNumber = card.customer.documentNumber;
    row.customer = card.customer;
    row.product = card.product;
    row.forceError = card.forceError ?? null;
    row.status = card.status;
    row.createdAt = card.createdAt;
    return row;
  }

  private toDomain(row: CardRequestOrmEntity): CardRequestEntity {
    return {
      requestId: row.requestId,
      customer: row.customer,
      product: row.product,
      ...(row.forceError !== null && { forceError: row.forceError }),
      status: row.status,
      createdAt: row.createdAt
    };
  }
}

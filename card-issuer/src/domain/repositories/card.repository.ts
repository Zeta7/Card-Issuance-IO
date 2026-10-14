import { CardRequestEntity } from '../entities/card-request.entity';

export interface ReserveResult {
  reserved: boolean;
  existing?: CardRequestEntity;
}

export interface CardRepository {
  reserve(card: CardRequestEntity): Promise<ReserveResult>;
  findAll(): Promise<CardRequestEntity[]>;
  updateStatus(requestId: string, status: 'PENDING' | 'ISSUED' | 'FAILED'): Promise<void>;
}

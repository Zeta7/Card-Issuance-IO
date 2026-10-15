import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import type { Customer, Product } from '../../../domain/entities/card-request.entity';

// customer/product quedan como jsonb: son datos de lectura/escritura
// completa, no se consultan campo por campo, así que no vale la pena
// normalizarlos en columnas propias. documentNumber y status sí son
// columnas reales porque reserve() filtra por ellos.
//
// El índice único parcial (documentNumber, solo para status != 'FAILED')
// es lo que reemplaza la "reserva atómica en memoria" ahora que hay
// múltiples instancias/conexiones posibles: la base de datos es quien
// arbitra la carrera, no el proceso de Node.
@Entity({ name: 'card_requests' })
@Index(['documentNumber'], { unique: true, where: "status != 'FAILED'" })
export class CardRequestOrmEntity {
  @PrimaryColumn('uuid', { name: 'request_id' })
  requestId!: string;

  @Column('varchar', { name: 'document_number', length: 8 })
  documentNumber!: string;

  @Column('jsonb')
  customer!: Customer;

  @Column('jsonb')
  product!: Product;

  @Column('boolean', { name: 'force_error', nullable: true })
  forceError!: boolean | null;

  @Column('varchar')
  status!: 'PENDING' | 'ISSUED' | 'FAILED';

  @Column('timestamptz', { name: 'created_at' })
  createdAt!: Date;
}

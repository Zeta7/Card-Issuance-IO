import { EventIdUtil } from '../utils/event-id.util';

export interface CloudEvent<T> {
  id: number;
  source: string;
  type: string;
  time: string;
  data: T;
}

// Mismo envelope CloudEvents que usa card-issuer. Se duplica a propósito en
// vez de vivir en un paquete "shared": cada microservicio mantiene su propio
// contrato y puede desplegarse de forma independiente sin coordinar releases
// de una librería común (trade-off típico de microservicios vs. DRY estricto).
export class CloudEventFactory {
  static create<T>(type: string, source: string, data: T): CloudEvent<T> {
    return {
      id: EventIdUtil.next(source),
      source,
      type,
      time: new Date().toISOString(),
      data
    };
  }
}

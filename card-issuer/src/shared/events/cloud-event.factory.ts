import { EventIdUtil } from '../utils/event-id.util';

export interface CloudEvent<T> {
  id: number;
  source: string;
  type: string;
  time: string;
  data: T;
}

// Envelope único para todos los eventos publicados, siguiendo la estructura
// CloudEvents acordada en el reto (id, source, type, time, data).
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

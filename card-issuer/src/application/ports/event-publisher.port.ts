export interface EventPublisherPort {
  // "key" fija la partición de Kafka: todos los eventos de un mismo flujo
  // (requestId) deben quedar en la misma partición para preservar su orden.
  publish(topic: string, message: unknown, key?: string): Promise<void>;
}

export type AppPublisher = EventPublisherPort & { isConnected(): boolean };

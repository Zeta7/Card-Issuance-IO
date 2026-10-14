export interface EventPublisherPort {
  publish(topic: string, message: unknown, key?: string): Promise<void>;
}

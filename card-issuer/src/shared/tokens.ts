// Los puertos (CardRepository, EventPublisherPort) son interfaces de TypeScript:
// no dejan rastro en tiempo de ejecución, así que Nest necesita un token
// explícito (no la interfaz) para poder inyectarlos por constructor.
export const CARD_REPOSITORY = Symbol('CARD_REPOSITORY');
export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');

// EventPublisherPort y RetryPolicy son interfaces/tipos de TypeScript: no
// dejan rastro en tiempo de ejecución, así que Nest necesita un token
// explícito (no el tipo) para poder inyectarlos por constructor.
export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');
export const RETRY_POLICY = Symbol('RETRY_POLICY');

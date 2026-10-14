// El id de CloudEvents debe ser autoincremental "por cada evento en la ejecución"
// (por flujo), no un contador global del proceso: cada "source" (requestId) lleva
// su propia secuencia para que distintos flujos concurrentes no se pisen entre sí.
// Limitación conocida: al vivir en memoria, no persiste entre reinicios ni se
// comparte entre card-issuer y card-processor; en producción se resolvería con un
// identificador distribuido (p. ej. ULID) o una secuencia respaldada por el broker.
export class EventIdUtil {
  private static readonly countersBySource = new Map<string, number>();

  static next(source: string): number {
    const current = (this.countersBySource.get(source) ?? 0) + 1;
    this.countersBySource.set(source, current);
    return current;
  }
}

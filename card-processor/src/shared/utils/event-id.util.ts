// Ver la misma nota en card-issuer/src/shared/utils/event-id.util.ts: el id
// es autoincremental por flujo (source), no un contador global del proceso.
export class EventIdUtil {
  private static readonly countersBySource = new Map<string, number>();

  static next(source: string): number {
    const current = (this.countersBySource.get(source) ?? 0) + 1;
    this.countersBySource.set(source, current);
    return current;
  }
}

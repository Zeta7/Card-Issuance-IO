import { Injectable, Optional } from '@nestjs/common';

export interface RetryPolicy {
  readonly maxAttempts: number;
  delayFor(attempt: number): number;
  wait(attempt: number): Promise<void>;
}

// Strategy pattern: aísla la política de reintentos del caso de uso para que
// pueda sustituirse (p. ej. en tests, por una política sin delays reales) sin
// tocar ProcessCardIssueUseCase — abierto a extensión, cerrado a modificación.
@Injectable()
export class ExponentialBackoffRetryPolicy implements RetryPolicy {
  constructor(
    @Optional() public readonly maxAttempts: number = 3,
    @Optional() private readonly delaysMs: readonly number[] = [1000, 2000, 4000]
  ) {}

  delayFor(attempt: number): number {
    return this.delaysMs[attempt - 1] ?? this.delaysMs[this.delaysMs.length - 1] ?? 0;
  }

  async wait(attempt: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.delayFor(attempt)));
  }
}

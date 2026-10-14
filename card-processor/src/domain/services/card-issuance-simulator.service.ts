import { Injectable } from '@nestjs/common';

@Injectable()
export class CardIssuanceSimulatorService {
  async process(forceError?: boolean): Promise<void> {
    const delay = Math.floor(Math.random() * (500 - 200 + 1)) + 200;
    await new Promise(resolve => setTimeout(resolve, delay));
    if (forceError) throw new Error('Fallo en la emisión forzada');

    const success = Math.random() > 0.5;
    if (!success) throw new Error('Fallo en la emisión aleatoria');
  }
}

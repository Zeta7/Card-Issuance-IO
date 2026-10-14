import { v4 as uuid } from 'uuid';
import { Injectable } from '@nestjs/common';

import { CardEntity } from '../entities/card.entity';

@Injectable()
export class CardGeneratorService {
  generate(holderName: string, currency: 'PEN' | 'USD'): CardEntity {
    return {
      cardId: uuid(),
      cardNumber: this.generateCardNumber(),
      expirationDate: this.generateExpirationDate(),
      cvv: this.generateCVV(),
      holderName,
      currency,
      type: 'VISA',
      status: 'ISSUED'
    };
  }

  // VISA siempre empieza en "4"; el último dígito se calcula con Luhn para
  // que el número generado sea un PAN con checksum válido, no 16 dígitos
  // puramente aleatorios.
  private generateCardNumber(): string {
    const prefix = '4';
    const randomBody = Array.from({ length: 14 }, () => Math.floor(Math.random() * 10)).join('');
    const partialNumber = prefix + randomBody;

    return partialNumber + this.calculateLuhnCheckDigit(partialNumber);
  }

  private calculateLuhnCheckDigit(partialNumber: string): number {
    let sum = 0;
    let shouldDouble = true;

    for (let i = partialNumber.length - 1; i >= 0; i--) {
      let digit = Number(partialNumber[i]);

      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      shouldDouble = !shouldDouble;
    }

    return (10 - (sum % 10)) % 10;
  }

  private generateExpirationDate() {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 5);

    return date.toISOString().slice(0, 7);
  }

  private generateCVV() {
    return Math.floor(100 + Math.random() * 900).toString();
  }
}

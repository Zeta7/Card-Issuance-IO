import { CardGeneratorService } from '../../src/domain/services/card-generator.service';

const isLuhnValid = (cardNumber: string): boolean => {
  let sum = 0;
  let shouldDouble = false;

  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = Number(cardNumber[i]);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
};

describe('CardGeneratorService', () => {
  it('genera una tarjeta VISA con número de 16 dígitos válido según Luhn', () => {
    const generator = new CardGeneratorService();

    const card = generator.generate('Jose Perez', 'PEN');

    expect(card.cardNumber).toHaveLength(16);
    expect(card.cardNumber.startsWith('4')).toBe(true);
    expect(isLuhnValid(card.cardNumber)).toBe(true);
    expect(card.cvv).toMatch(/^\d{3}$/);
    expect(card.type).toBe('VISA');
    expect(card.status).toBe('ISSUED');
    expect(card.holderName).toBe('Jose Perez');
    expect(card.currency).toBe('PEN');
  });

  it('genera una fecha de vencimiento 5 años en el futuro', () => {
    const generator = new CardGeneratorService();
    const now = new Date();

    const card = generator.generate('Jose Perez', 'USD');

    expect(card.expirationDate).toBe(
      `${now.getFullYear() + 5}-${String(now.getMonth() + 1).padStart(2, '0')}`
    );
  });
});

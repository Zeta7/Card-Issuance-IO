export interface CardEntity {
  cardId: string;
  cardNumber: string;
  expirationDate: string;
  cvv: string;
  holderName: string;
  currency: 'PEN' | 'USD';
  type: 'VISA';
  status: 'ISSUED';
}

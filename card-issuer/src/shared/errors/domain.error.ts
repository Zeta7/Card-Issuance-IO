export abstract class DomainError extends Error {
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class DuplicateCardRequestError extends DomainError {
  readonly statusCode = 409;

  constructor(documentNumber: string) {
    super(`El cliente con documento ${documentNumber} ya tiene una solicitud de tarjeta activa`);
  }
}

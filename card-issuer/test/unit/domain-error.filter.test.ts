import { ZodError } from 'zod';
import { ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';

import { DomainErrorFilter } from '../../src/infrastructure/http/filters/domain-error.filter';
import { DuplicateCardRequestError } from '../../src/shared/errors/domain.error';

const buildHost = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const request = { requestId: 'req-1' } as Request;
  const response = { status } as unknown as Response;

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request
    })
  } as unknown as ArgumentsHost;

  return { host, status, json };
};

describe('DomainErrorFilter', () => {
  const filter = new DomainErrorFilter();

  it('responde 409 para un DomainError (DuplicateCardRequestError)', () => {
    const { host, status } = buildHost();

    filter.catch(new DuplicateCardRequestError('73425419'), host);

    expect(status).toHaveBeenCalledWith(409);
  });

  it('responde 400 con los detalles de validación para un ZodError', () => {
    const { host, status } = buildHost();
    const zodError = new ZodError([
      { code: 'custom', path: ['customer', 'age'], message: 'Edad inválida' }
    ]);

    filter.catch(zodError, host);

    expect(status).toHaveBeenCalledWith(400);
  });

  it('responde 500 con un mensaje genérico para un error no controlado, sin filtrar el mensaje interno', () => {
    const { host, status, json } = buildHost();

    filter.catch(new Error('detalle interno sensible'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ message: 'Error interno del servidor' });
  });
});

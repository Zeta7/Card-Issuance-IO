import { Request, Response } from 'express';

import { requestIdMiddleware } from '../../src/infrastructure/http/middlewares/request-id.middleware';

const buildReqRes = (incomingHeader?: string) => {
  const req = { header: jest.fn().mockReturnValue(incomingHeader) } as unknown as Request;
  const setHeader = jest.fn();
  const res = { setHeader } as unknown as Response;
  return { req, res, setHeader };
};

describe('requestIdMiddleware', () => {
  it('reutiliza el x-request-id entrante si viene presente', () => {
    const { req, res, setHeader } = buildReqRes('id-del-cliente');
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe('id-del-cliente');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'id-del-cliente');
    expect(next).toHaveBeenCalled();
  });

  it('genera un uuid cuando no viene x-request-id', () => {
    const { req, res } = buildReqRes(undefined);
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(next).toHaveBeenCalled();
  });
});

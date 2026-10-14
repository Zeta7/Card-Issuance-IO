import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
  }
}

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && incoming.length > 0 ? incoming : randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
};

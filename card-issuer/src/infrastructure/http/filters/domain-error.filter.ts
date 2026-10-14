import { ZodError } from 'zod';
import { Request, Response } from 'express';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';

import { logger } from '../../logger/logger';
import { DomainError } from '../../../shared/errors/domain.error';

// Filtro global: evita filtrar stacks/mensajes internos al cliente y traduce
// cada tipo de error conocido a su código HTTP correcto.
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof ZodError) {
      response.status(400).json({
        message: 'Payload inválido',
        details: exception.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      });
      return;
    }

    if (exception instanceof DomainError) {
      response.status(exception.statusCode).json({ message: exception.message });
      return;
    }

    logger.error({ err: exception, requestId: request.requestId }, 'Error no controlado');
    response.status(500).json({ message: 'Error interno del servidor' });
  }
}

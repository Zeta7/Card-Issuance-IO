import { ZodSchema } from 'zod';
import { PipeTransform } from '@nestjs/common';

// Reemplaza el ValidationPipe + class-validator "de catálogo" de Nest: en vez
// de DTOs con decoradores, seguimos validando con el mismo esquema Zod de
// siempre. El ZodError que tira .parse() lo traduce a 400 el DomainErrorFilter.
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}

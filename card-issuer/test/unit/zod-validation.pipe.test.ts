import { z } from 'zod';

import { ZodValidationPipe } from '../../src/infrastructure/http/pipes/zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const schema = z.object({ name: z.string().min(1) });
  const pipe = new ZodValidationPipe(schema);

  it('devuelve el valor parseado cuando es válido', () => {
    expect(pipe.transform({ name: 'Jose' })).toEqual({ name: 'Jose' });
  });

  it('tira ZodError cuando el valor no cumple el esquema', () => {
    expect(() => pipe.transform({ name: '' })).toThrow();
  });
});

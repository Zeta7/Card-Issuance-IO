import { DuplicateCardRequestError } from '../../src/shared/errors/domain.error';

describe('DuplicateCardRequestError', () => {
  it('expone el statusCode 409 y un mensaje con el documento', () => {
    const error = new DuplicateCardRequestError('73425419');

    expect(error.statusCode).toBe(409);
    expect(error.name).toBe('DuplicateCardRequestError');
    expect(error.message).toContain('73425419');
    expect(error).toBeInstanceOf(Error);
  });
});

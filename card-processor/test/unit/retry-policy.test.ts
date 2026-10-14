import { ExponentialBackoffRetryPolicy } from '../../src/shared/utils/retry-policy';

describe('ExponentialBackoffRetryPolicy', () => {
  it('devuelve los delays 1s/2s/4s para los intentos 1, 2 y 3', () => {
    const policy = new ExponentialBackoffRetryPolicy();

    expect(policy.delayFor(1)).toBe(1000);
    expect(policy.delayFor(2)).toBe(2000);
    expect(policy.delayFor(3)).toBe(4000);
  });

  it('usa el último delay configurado para intentos por encima del máximo', () => {
    const policy = new ExponentialBackoffRetryPolicy();
    expect(policy.delayFor(4)).toBe(4000);
  });

  it('maxAttempts por defecto es 3', () => {
    const policy = new ExponentialBackoffRetryPolicy();
    expect(policy.maxAttempts).toBe(3);
  });

  it('wait() espera exactamente el delay correspondiente al intento', async () => {
    jest.useFakeTimers();
    const policy = new ExponentialBackoffRetryPolicy();

    let resolved = false;
    policy.wait(2).then(() => {
      resolved = true;
    });

    await jest.advanceTimersByTimeAsync(1999);
    expect(resolved).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    expect(resolved).toBe(true);

    jest.useRealTimers();
  });
});

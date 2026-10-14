import { CardIssuanceSimulatorService } from '../../src/domain/services/card-issuance-simulator.service';

describe('CardIssuanceSimulatorService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('lanza error cuando forceError es true, sin importar el azar', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99); // favorecería el éxito si no fuera forzado
    const simulator = new CardIssuanceSimulatorService();

    await expect(simulator.process(true)).rejects.toThrow('Fallo en la emisión forzada');
  });

  it('resuelve cuando el azar favorece el éxito', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const simulator = new CardIssuanceSimulatorService();

    await expect(simulator.process(false)).resolves.toBeUndefined();
  });

  it('lanza error cuando el azar no favorece el éxito', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.1);
    const simulator = new CardIssuanceSimulatorService();

    await expect(simulator.process(false)).rejects.toThrow('Fallo en la emisión aleatoria');
  });
});

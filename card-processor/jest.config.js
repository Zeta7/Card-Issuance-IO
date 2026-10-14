/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/test'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }]
  },
  collectCoverage: true,
  // Se excluyen el bootstrap del proceso y los adaptadores finos de Kafka/logger/
  // config (wiring sin lógica propia, mejor validados contra infraestructura real
  // que con mocks de bajo valor) para que el umbral de cobertura mida código con
  // lógica de negocio real.
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/infrastructure/kafka/**',
    '!src/infrastructure/logger/**',
    '!src/shared/config/**'
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};

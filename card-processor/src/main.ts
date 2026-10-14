import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { logger } from './infrastructure/logger/logger';

async function bootstrap() {
  // No hay servidor HTTP acá: es un worker, así que alcanza con un contexto
  // de aplicación (contenedor de DI) en vez de NestFactory.create().
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  // enableShutdownHooks hace que Nest llame a onModuleDestroy() en cada
  // provider (desconectar el producer y el consumer de Kafka) cuando llega
  // SIGINT/SIGTERM, en vez de manejar las señales a mano.
  app.enableShutdownHooks();

  logger.info('card-processor listo');
}

bootstrap().catch(error => {
  logger.error({ err: error }, 'Error fatal al iniciar card-processor');
  process.exit(1);
});

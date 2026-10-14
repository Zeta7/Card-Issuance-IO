import 'reflect-metadata';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { env } from './shared/config/env.config';
import { logger } from './infrastructure/logger/logger';
import { openApiDocument } from './infrastructure/http/docs/openapi.doc';

async function bootstrap() {
  // Apagamos el logger propio de Nest: pino ya cubre todo el logging de la app.
  const app = await NestFactory.create(AppModule, { logger: false });

  app.use(helmet());
  app.enableCors({ origin: env.corsOrigin });

  SwaggerModule.setup('docs', app, openApiDocument as OpenAPIObject);

  // enableShutdownHooks hace que Nest llame a onModuleDestroy() en cada
  // provider (desconectar el producer y el consumer de Kafka) cuando llega
  // SIGINT/SIGTERM, en vez de manejar las señales a mano.
  app.enableShutdownHooks();

  await app.listen(env.port);
  logger.info(`Emisor de tarjetas ejecutándose en el puerto ${env.port}`);
}

bootstrap().catch(error => {
  logger.error({ err: error }, 'Error fatal al iniciar card-issuer');
  process.exit(1);
});

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';

import { AppModule } from './app.module';
import { setupDocs } from './docs';
import { PinoNestLogger, requestLoggingMiddleware } from './logger';

async function bootstrap(): Promise<void> {
  // bufferLogs: hold early boot logs until pino takes over below.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = new PinoNestLogger('Bootstrap');
  app.useLogger(logger);
  app.use(requestLoggingMiddleware);
  // All PRD endpoints live under /api; the liveness probe stays at /health.
  app.setGlobalPrefix('api', { exclude: ['health'] });

  // Single validation story: Zod schemas (via createZodDto DTOs) validate
  // every body/query/param. Safe for DTO-less routes like /health.
  app.useGlobalPipes(new ZodValidationPipe());

  setupDocs(app);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  logger.log(`listening on :${port}`);
  logger.debug(`ENV: ${process.env.NODE_ENV}`);
}

void bootstrap();

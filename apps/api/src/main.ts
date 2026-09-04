import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { setupDocs } from './docs';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  // All PRD endpoints live under /api; the liveness probe stays at /health.
  app.setGlobalPrefix('api', { exclude: ['health'] });

  setupDocs(app);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`@declic/api listening on :${port}`);
}

void bootstrap();

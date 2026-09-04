import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

import packageJson from '../package.json';

/**
 * Mounts the OpenAPI spec + Scalar UI at /docs (Express middleware, hence
 * outside the /api global prefix by construction). Shared by src/main.ts
 * and the docs e2e so tests exercise the production wiring verbatim.
 *
 * Served in every environment: the API surface is public by design,
 * sensitive routes stay behind RolesGuard, not spec secrecy.
 */
export function setupDocs(app: INestApplication): void {
  // Code-first spec; Zod-backed DTOs via createZodDto() land here
  // automatically as endpoints are built (no hand-written DTO duplication).
  const openApiConfig = new DocumentBuilder()
    .setTitle('Déclic API')
    .setDescription('Curated photo exhibitions — UKM CLIC UNNES')
    .setVersion(packageJson.version)
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'token' },
      'bearer',
    )
    .build();
  const document = SwaggerModule.createDocument(app, openApiConfig);
  app.use('/docs', apiReference({ content: document }));
}

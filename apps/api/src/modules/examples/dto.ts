import { createExampleWorkSchema, exampleWorkSchema } from '@declic/contracts';
import { createZodDto } from 'nestjs-zod';

// Thin wrappers: the schemas (single source of truth) live in
// @declic/contracts. These classes carry them into NestJS validation
// (ZodValidationPipe) and Swagger docs — no hand-written @ApiProperty.
export class CreateExampleWorkDto extends createZodDto(
  createExampleWorkSchema,
) {}

export class ExampleWorkDto extends createZodDto(exampleWorkSchema) {}

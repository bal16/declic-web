import { Module } from '@nestjs/common';

import { ExamplesController } from './examples.controller';
import { ExamplesService } from './examples.service';

// LIVING EXAMPLE — not production code. Demonstrates the contracts → DTO →
// validation → Swagger chain end to end. Delete (or harvest patterns from)
// this module when the real posts module lands (PRD-API.md §1.1, §4.1).
@Module({
  controllers: [ExamplesController],
  providers: [ExamplesService],
})
export class ExamplesModule {}

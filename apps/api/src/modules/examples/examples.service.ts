import type { CreateExampleWork, ExampleWork } from '@declic/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';

@Injectable()
export class ExamplesService {
  // In-memory stand-in: the real posts module persists via packages/db
  // (Drizzle) once it lands. Never copy this store into production code.
  private readonly works = new Map<string, ExampleWork>();

  create(input: CreateExampleWork): ExampleWork {
    const work: ExampleWork = {
      ...input,
      id: createId(),
      createdAt: new Date().toISOString(),
    };
    this.works.set(work.id, work);
    return work;
  }

  findOne(id: string): ExampleWork {
    const work = this.works.get(id);
    if (!work) {
      throw new NotFoundException(`work ${id} not found`);
    }
    return work;
  }
}

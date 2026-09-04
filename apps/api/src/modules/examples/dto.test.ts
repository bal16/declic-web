import { describe, expect, it } from 'bun:test';

import { ZodValidationPipe } from 'nestjs-zod';

import { CreateExampleWorkDto } from './dto';

// Proves the shared contract schema rejects bad input through the same
// pipe main.ts installs globally. Valid input passes through untouched.
describe('CreateExampleWorkDto validation', () => {
  const pipe = new ZodValidationPipe(CreateExampleWorkDto);

  it('accepts a valid SINGLE work', async () => {
    const result = (await pipe.transform(
      { title: 'Kota Lama', type: 'SINGLE', itemCount: 1 },
      { type: 'body', metatype: CreateExampleWorkDto },
    )) as { title: string };
    expect(result.title).toBe('Kota Lama');
  });

  it('rejects an empty title', async () => {
    try {
      await pipe.transform(
        { title: '', type: 'SINGLE', itemCount: 1 },
        { type: 'body', metatype: CreateExampleWorkDto },
      );
      expect.unreachable('invalid title passed validation');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });

  it('rejects itemCount above the series cap', async () => {
    try {
      await pipe.transform(
        { title: 'Too many', type: 'SERIES', itemCount: 99 },
        { type: 'body', metatype: CreateExampleWorkDto },
      );
      expect.unreachable('over-cap itemCount passed validation');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});

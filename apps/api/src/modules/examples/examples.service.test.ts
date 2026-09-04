import { describe, expect, it } from 'bun:test';

import { NotFoundException } from '@nestjs/common';

import { ExamplesService } from './examples.service';

describe('ExamplesService', () => {
  it('create() assigns id + createdAt and stores the work', () => {
    const service = new ExamplesService();
    const work = service.create({
      title: 'Morning Market',
      type: 'SINGLE',
      itemCount: 1,
    });
    expect(work.id.length).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(work.createdAt))).toBe(false);
    expect(service.findOne(work.id)).toEqual(work);
  });

  it('findOne() throws NotFoundException for unknown ids', () => {
    const service = new ExamplesService();
    expect(() => service.findOne('nope')).toThrow(NotFoundException);
  });
});

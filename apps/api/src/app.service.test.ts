import 'reflect-metadata';
import { describe, expect, it } from 'bun:test';

import { AppService } from './app.service';

describe('AppService', () => {
  const service = new AppService();

  it('health() reports ok for the api service', () => {
    const result = service.health();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('api');
    expect(Number.isNaN(Date.parse(result.time))).toBe(false);
  });
});

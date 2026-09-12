import { describe, expect, it } from 'bun:test';

import { IMAGE_JOB_OPTIONS } from './job-options';

// Drift-guard for the cross-slice contract: the api producer must mirror
// these numbers (attempts/backoff live producer-side).
describe('IMAGE_JOB_OPTIONS', () => {
  it('matches PRD-Worker §4.1 resilience numbers', () => {
    expect(IMAGE_JOB_OPTIONS.attempts).toBe(3);
    expect(IMAGE_JOB_OPTIONS.backoff).toEqual({
      type: 'exponential',
      delay: 5000,
    });
    expect(IMAGE_JOB_OPTIONS.removeOnComplete).toEqual({
      age: 3600,
      count: 1000,
    });
    expect(IMAGE_JOB_OPTIONS.removeOnFail).toEqual({
      age: 7 * 24 * 3600,
    });
  });
});

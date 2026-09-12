import type { JobsOptions } from 'bullmq';

// Canonical resilience numbers (PRD-Worker.md §4.1). Attempts/backoff are
// producer-side: whoever enqueues (api slice, tests) must set these.
// The worker documents them here so both sides mirror one source.
export const IMAGE_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

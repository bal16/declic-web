import { describe, expect, it } from 'bun:test';

import { getRouter } from './router';

describe('getRouter', () => {
  it('builds a router with scroll restoration', () => {
    const router = getRouter();
    expect(router).toBeDefined();
    expect(router.options.scrollRestoration).toBe(true);
  });

  it('builds independent instances', () => {
    expect(getRouter()).not.toBe(getRouter());
  });
});

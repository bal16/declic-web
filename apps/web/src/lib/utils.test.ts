import { describe, expect, it } from 'bun:test';

import { cn } from './utils';

describe('cn', () => {
  it('skips falsy classes', () => {
    expect(cn('a', undefined, null, 'c')).toBe('a c');
  });

  it('resolves conflicts last-wins', () => {
    expect(cn('p-1', 'p-2')).toBe('p-2');
  });
});

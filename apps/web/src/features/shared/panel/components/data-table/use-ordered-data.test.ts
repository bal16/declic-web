import { describe, expect, it } from 'bun:test';

import { reorderRows } from './use-ordered-data';

const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];

describe('reorderRows', () => {
  it('moves the active row onto the target position', () => {
    expect(reorderRows(rows, 1, 3)?.map((r) => r.id)).toEqual([2, 3, 1]);
    expect(reorderRows(rows, 3, 1)?.map((r) => r.id)).toEqual([3, 1, 2]);
  });

  it('returns null when nothing moves', () => {
    expect(reorderRows(rows, 2, 2)).toBeNull();
    expect(reorderRows(rows, 1, 99)).toBeNull();
    expect(reorderRows(rows, 99, 1)).toBeNull();
  });

  it('does not mutate the input', () => {
    reorderRows(rows, 1, 3);
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
  });
});

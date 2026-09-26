import { mock } from 'bun:test';

let hookState: {
  data: { user: { role: string } } | null;
  isPending: boolean;
} = { data: null, isPending: false };

mock.module('./client', () => ({
  authClient: { useSession: () => hookState },
}));

import { describe, expect, it } from 'bun:test';

import { renderHook } from '@testing-library/react';

import { useSessionRole } from './session';

describe('UseSessionRole', () => {
  it('returns undefined while loading', () => {
    hookState = { data: null, isPending: true };

    const { result } = renderHook(() => useSessionRole());
    expect(result.current).toBeUndefined();
  });

  it('returns null when anonymous', () => {
    hookState = { data: null, isPending: false };

    const { result } = renderHook(() => useSessionRole());
    expect(result.current).toBeNull();
  });

  it('returns the validated role', () => {
    hookState = { data: { user: { role: 'CURATOR' } }, isPending: false };

    const { result } = renderHook(() => useSessionRole());
    expect(result.current).toBe('CURATOR');
  });

  it('returns null for an unknown role', () => {
    hookState = { data: { user: { role: 'SUPERADMIN' } }, isPending: false };

    const { result } = renderHook(() => useSessionRole());
    expect(result.current).toBeNull();
  });
});

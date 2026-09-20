import { describe, it, expect } from 'bun:test';

import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { type PermissionKey } from './role-matrix';
import { RolesGuard } from './roles.guard';

interface FakeReq {
  headers?: Record<string, string>;
  session?: unknown;
}

function reflectorWith(returnValue: PermissionKey | undefined) {
  return {
    getAllAndOverride: () => returnValue,
  } as unknown as Reflector;
}

function ctxWith(req: FakeReq) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows request without a permission sticker', () => {
    const reflector = reflectorWith(undefined);
    const guard = new RolesGuard(reflector);

    const context = ctxWith({ session: { user: { role: 'VIEWER' } } });
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('allows a role listed in the matrix', () => {
    const reflector = reflectorWith('posts:write' as PermissionKey);
    const guard = new RolesGuard(reflector);

    const context = ctxWith({ session: { user: { role: 'ADMIN' } } });
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('denies a role missing from the matrix with FORBIDDEN', () => {
    const reflector = reflectorWith('posts:write' as PermissionKey);
    const guard = new RolesGuard(reflector);

    const context = ctxWith({ session: { user: { role: 'VIEWER' } } });

    try {
      guard.canActivate(context);
      expect.unreachable();
    } catch (e: unknown) {
      if (!(e instanceof ForbiddenException)) throw e;
      expect((e.getResponse() as { code: string }).code).toBe('FORBIDDEN');
    }
  });

  it('denies request without a session', () => {
    const reflector = reflectorWith('posts:write' as PermissionKey);
    const guard = new RolesGuard(reflector);

    const context = ctxWith({ session: null });

    try {
      guard.canActivate(context);
      expect.unreachable();
    } catch (e: unknown) {
      if (!(e instanceof ForbiddenException)) throw e;
      expect((e.getResponse() as { code: string }).code).toBe('FORBIDDEN');
    }
  });
});

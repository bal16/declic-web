import { describe, it, expect } from 'bun:test';

import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { newFakeAuth } from '../../../test/helpers/auth.doubles';
import { SessionGuard } from './session.guard';

interface FakeReq {
  headers: Record<string, string>;
  session?: unknown;
}

function reflectorWith(isPublicValue: boolean): Reflector {
  return {
    getAllAndOverride: () => isPublicValue,
  } as unknown as Reflector;
}

function ctxWith(req: FakeReq): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('SessionGuard', () => {
  it('skips session lookup for public routes', async () => {
    const guard = new SessionGuard(reflectorWith(true), newFakeAuth(null));
    const req: FakeReq = { headers: {} };

    const result = await guard.canActivate(ctxWith(req));
    expect(result).toBe(true);
  });

  it('rejects requests without a session with UNAUTHENTICATED', async () => {
    const guard = new SessionGuard(reflectorWith(false), newFakeAuth(null));
    const req: FakeReq = { headers: {} };

    try {
      await guard.canActivate(ctxWith(req));
      expect.unreachable();
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(UnauthorizedException);
      expect((e as { getResponse(): unknown }).getResponse()).toMatchObject({
        code: 'UNAUTHENTICATED',
      });
    }
  });

  it('attaches the session and allows the request', async () => {
    const mockData = {
      user: { id: 'u-1', email: 'viewer@declic.test', role: 'VIEWER' },
      session: { id: 's-1', token: 't-1' },
    };
    const guard = new SessionGuard(reflectorWith(false), newFakeAuth(mockData));
    const req: FakeReq = { headers: {} };

    const result = await guard.canActivate(ctxWith(req));

    expect(result).toBe(true);
    expect(req.session).toEqual(mockData);
  });
});

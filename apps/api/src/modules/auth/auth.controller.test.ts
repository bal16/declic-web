import { describe, expect, it } from 'bun:test';

import type { UserSession } from '@thallesp/nestjs-better-auth';

import type { Auth } from './auth';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const controller = new AuthController();

  it('answers ping without a session', () => {
    expect(controller.ping()).toBe('pong');
  });

  it('returns the session user', async () => {
    const session = {
      user: { id: 'u-1', email: 'viewer@declic.test' },
    } as unknown as UserSession<Auth>;

    expect(await controller.getMe(session)).toEqual({ user: session.user });
  });

  it('answers admins', () => {
    expect(controller.admin()).toBe('admin');
  });
});

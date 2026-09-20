import { setupTestEnv } from './helpers/test-env';
setupTestEnv();

import { describe, it, beforeAll, afterAll, expect } from 'bun:test';

import { createDb, user, session } from '@declic/db';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { AppModule } from '../src/app.module';

const db = createDb(process.env.DATABASE_URL || '');

const viewerId = `e2e-user-${createId()}`;
const viewerSessionId = `e2e-sess-${createId()}`;
const viewerToken = `e2e-${createId()}`;

const adminId = `e2e-admin-${createId()}`;
const adminSessionId = `e2e-sess-${createId()}`;
const adminToken = `e2e-${createId()}`;

describe('Auth E2E Tests', () => {
  let app: INestApplication;
  let serverUrl: string;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api', { exclude: ['health'] });

    await app.listen(0);
    serverUrl = await app.getUrl();

    const futureDate = new Date(Date.now() + 3600000);

    await db.insert(user).values([
      {
        id: viewerId,
        email: 'viewer.e2e@test.com',
        name: 'E2E Viewer',
        role: 'VIEWER',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: adminId,
        email: 'admin.e2e@test.com',
        name: 'E2E Admin',
        role: 'ADMIN',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await db.insert(session).values([
      {
        id: viewerSessionId,
        userId: viewerId,
        token: viewerToken,
        expiresAt: futureDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: adminSessionId,
        userId: adminId,
        token: adminToken,
        expiresAt: futureDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(session).where(eq(session.token, viewerToken));
    await db.delete(session).where(eq(session.token, adminToken));
    await db.delete(user).where(eq(user.id, viewerId));
    await db.delete(user).where(eq(user.id, adminId));

    await app.close();
  });

  it('ping answers without a session', async () => {
    const res = await fetch(`${serverUrl}/api/auth-probe/ping`);
    expect(res.status).toBe(200);
  });

  it('me rejects requests without a session with 401', async () => {
    const res = await fetch(`${serverUrl}/api/auth-probe/me`);
    expect(res.status).toBe(401);

    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('UNAUTHENTICATED');
  });

  it('me returns the user with a session', async () => {
    const res = await fetch(`${serverUrl}/api/auth-probe/me`, {
      headers: {
        Authorization: `Bearer ${viewerToken}`,
      },
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.user?.email || body.email).toBe('viewer.e2e@test.com');
  });

  it('admin rejects insufficient roles with 403', async () => {
    const res = await fetch(`${serverUrl}/api/auth-probe/admin`, {
      headers: {
        Authorization: `Bearer ${viewerToken}`,
      },
    });
    expect(res.status).toBe(403);

    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('FORBIDDEN');
  });

  it('admin answers admins', async () => {
    const res = await fetch(`${serverUrl}/api/auth-probe/admin`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(res.status).toBe(200);
  });
});

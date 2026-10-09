import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import {
  account,
  createDb,
  session,
  user,
  verification,
  type Db,
} from '@declic/db';
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';

export function createAuth(db: Db = createDb()) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: user,
        session: session,
        account: account,
        verification: verification,
      },
    }),
    user: {
      additionalFields: {
        role: { type: 'string', defaultValue: 'VIEWER', required: true },
      },
    },
    trustedOrigins: [
      process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    ],
    plugins: [bearer()],
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID ?? '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  });
}

export type Auth = ReturnType<typeof createAuth>;

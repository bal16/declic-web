import { createFileRoute, redirect } from '@tanstack/react-router';

import { authClient } from '@/features/shared/auth/client';
import { LoginForm } from '@/features/shared/auth/login-form';

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    try {
      const { data } = await authClient.getSession();
      if (data?.user) {
        throw redirect({ to: '/' });
      }
    } catch (err) {
      // Swallowing is intentional: redirect() throws a Response (rethrown
      // above); anything else means offline — render login instead of a 500.
      if (err instanceof Response) throw err;
    }
  },
  component: () => <LoginForm />,
});

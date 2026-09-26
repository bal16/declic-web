import { createFileRoute } from '@tanstack/react-router';

import { ADMIN_ONLY, requireRoles } from '@/features/shared/auth/guards';

export const Route = createFileRoute('/_authed/_admin/users')({
  beforeLoad: () => requireRoles(ADMIN_ONLY, '/403'),
  staticData: { title: 'Users' },
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/_admin/users"!</div>;
}

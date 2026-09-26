import { createFileRoute } from '@tanstack/react-router';

import { ADMIN_ONLY, requireRoles } from '@/features/shared/auth/guards';

export const Route = createFileRoute('/_authed/_admin/exhibitions')({
  beforeLoad: () => requireRoles(ADMIN_ONLY, '/403'),
  staticData: { title: 'Exhibitions' },
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/_admin/exhibitions"!</div>;
}

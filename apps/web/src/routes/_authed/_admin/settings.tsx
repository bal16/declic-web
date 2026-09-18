import { createFileRoute } from '@tanstack/react-router';

import { ADMIN_ONLY, requireRoles } from '@/features/shared/auth/guards';

export const Route = createFileRoute('/_authed/_admin/settings')({
  beforeLoad: () => requireRoles(ADMIN_ONLY),
  staticData: { title: 'Settings' },
  component: RouteComponent,
});

// Skeleton placeholder under the _admin pathless layout.
// Gated by ADMIN role via beforeLoad above.
function RouteComponent() {
  return <div>Hello "/settings"!</div>;
}

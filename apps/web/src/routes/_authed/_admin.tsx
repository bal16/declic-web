import { Outlet, createFileRoute } from '@tanstack/react-router';

import { STAFF_ROLES, requireRoles } from '@/features/shared/auth/guards';

export const Route = createFileRoute('/_authed/_admin')({
  beforeLoad: () => requireRoles(STAFF_ROLES),
  component: RouteComponent,
});

// PATHLESS layout nested inside _authed: no URL segment. Session is
// already guaranteed by the parent — this wall only checks staff role
// (CURATOR|ADMIN). Inherits the panel shell; children render in <Outlet/>.
function RouteComponent() {
  return <Outlet />;
}

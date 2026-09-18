import { createFileRoute } from '@tanstack/react-router';

import {
  PHOTOGRAPHER_ROLES,
  requireRoles,
} from '@/features/shared/auth/guards';

export const Route = createFileRoute('/_authed/dashboard/upload')({
  beforeLoad: () => requireRoles(PHOTOGRAPHER_ROLES),
  staticData: { title: 'Upload' },
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/_authed/dashboard/upload"!</div>;
}

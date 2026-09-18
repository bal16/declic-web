import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/_admin/moderation')({
  staticData: { title: 'Moderation' },
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/_admin/moderation"!</div>;
}

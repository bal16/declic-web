import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/_admin/curate')({
  staticData: { title: 'Kurasi' },
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/_admin/curate"!</div>;
}

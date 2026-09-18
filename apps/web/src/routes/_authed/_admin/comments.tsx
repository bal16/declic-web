import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/_admin/comments')({
  staticData: { title: 'Komentar' },
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/_admin/comments"!</div>;
}

import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/archive')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/archive"!</div>;
}

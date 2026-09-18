import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/og/$postId')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/og/"!</div>;
}

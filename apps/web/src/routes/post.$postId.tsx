import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/post/$postId')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/post/"!</div>;
}

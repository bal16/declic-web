import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/exhibition/$slug')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/exhibition/"!</div>;
}

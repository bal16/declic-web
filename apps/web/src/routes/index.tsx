import { createFileRoute } from '@tanstack/react-router';

import { getApiUrl } from '../lib/env';

export const Route = createFileRoute('/')({
  component: HomePage,
});

// Skeleton placeholder. Real gallery grid lands with the first vertical
// slice (PRD-FE.md §2.1), once packages/contracts + packages/db exist.
function HomePage(): React.JSX.Element {
  return (
    <main>
      <h1>Dclic</h1>
      <p>Momen yang diabadikan — skeleton daring, galeri menyusul.</p>
      <p>
        <small>API: {getApiUrl()}</small>
      </p>
    </main>
  );
}

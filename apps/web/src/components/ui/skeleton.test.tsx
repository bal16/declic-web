import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render } from '@testing-library/react';

import { Skeleton } from '@/components/ui/skeleton';

afterEach(() => {
  cleanup();
});

// Smoke coverage for the generated wrapper: renders without crashing.
describe('Skeleton wrapper', () => {
  it('renders', () => {
    const { container } = render(<Skeleton className="h-4 w-10" />);
    expect(container.firstChild).not.toBeNull();
  });
});

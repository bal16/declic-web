import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render, screen } from '@testing-library/react';
import { act } from 'react';

import { Toaster, createToastManager } from '@/components/ui/toast';

afterEach(() => {
  cleanup();
});

// Smoke coverage for the generated wrapper: a toast added through an
// isolated manager renders title and description.
describe('Toast wrappers', () => {
  it('renders an added toast', async () => {
    const manager = createToastManager();
    render(
      <Toaster toastManager={manager}>
        <div>Aplikasi</div>
      </Toaster>,
    );
    act(() => {
      manager.add({ title: 'Halo', description: 'Dunia' });
    });
    expect(await screen.findByText('Halo')).not.toBeNull();
    expect(screen.getByText('Dunia')).not.toBeNull();
  });
});

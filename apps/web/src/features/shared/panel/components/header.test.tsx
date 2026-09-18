import { afterEach, describe, expect, it } from 'bun:test';

// NOTE: reflects the CURRENT Header (title + actions slot). Update copy
// here when real page titles/actions land; the contract (title + actions
// render from props) stays.
import { cleanup, render, screen } from '@testing-library/react';

import { SidebarProvider } from '@/components/ui/sidebar';

import { Header } from './header';

afterEach(() => {
  cleanup();
});

describe('Header', () => {
  it('renders the given title, not a hardcoded one', () => {
    render(
      <SidebarProvider>
        <Header title="Uji Coba" />
      </SidebarProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Uji Coba' })).not.toBeNull();
    expect(screen.queryByText('Documents')).toBeNull();
  });

  it('renders actions when provided', () => {
    render(
      <SidebarProvider>
        <Header title="Uji Coba" actions={<button type="button">Act</button>} />
      </SidebarProvider>,
    );
    expect(screen.getByRole('button', { name: 'Act' })).not.toBeNull();
  });
});

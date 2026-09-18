import { afterEach, describe, expect, it, mock } from 'bun:test';

// NOTE: reflects the CURRENT NavUser (initials + menuItems prop). Menu
// content will change with real session wiring — update items here
// alongside, keep the open-and-fire contract.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { SidebarProvider } from '@/components/ui/sidebar';

import {
  givenUser,
  givenUserMenuItems,
} from '../../../../../test/factories/panel.factory';
import { NavUser } from './nav-user';

afterEach(() => {
  cleanup();
});

describe('NavUser', () => {
  it('derives avatar initials from the name', () => {
    render(
      <SidebarProvider>
        <NavUser user={givenUser()} menuItems={givenUserMenuItems()} />
      </SidebarProvider>,
    );
    expect(screen.getByText('UP')).not.toBeNull();
    expect(screen.queryByText('CN')).toBeNull();
  });

  it('opens the menu and fires the item handler', async () => {
    const onLogout = mock(() => {});
    const menuItems = givenUserMenuItems();
    menuItems[1].onClick = onLogout;
    render(
      <SidebarProvider>
        <NavUser user={givenUser()} menuItems={menuItems} />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByText('Uji Pengguna'));
    const item = await screen.findByRole('menuitem', { name: 'Keluar' });
    expect(screen.getByRole('menuitem', { name: 'Akun' })).not.toBeNull();
    fireEvent.click(item);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

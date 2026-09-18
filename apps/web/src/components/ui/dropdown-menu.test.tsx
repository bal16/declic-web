import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render, screen } from '@testing-library/react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

afterEach(() => {
  cleanup();
});

// Smoke coverage for the generated shadcn wrappers: every export renders
// without crashing so the coverage gate measures app code, not vendored UI.
describe('DropdownMenu wrappers', () => {
  it('renders every part', async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger render={<Button>Open</Button>} />
        <DropdownMenuPortal>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuLabel inset>Group</DropdownMenuLabel>
              <DropdownMenuItem inset>Plain</DropdownMenuItem>
              <DropdownMenuItem variant="destructive">Danger</DropdownMenuItem>
              <DropdownMenuCheckboxItem defaultChecked>
                Check
              </DropdownMenuCheckboxItem>
              <DropdownMenuRadioGroup defaultValue="a">
                <DropdownMenuRadioItem value="a">
                  Option A
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              Hint
              <DropdownMenuShortcut>⇧D</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger inset>More</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>Nested</DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>,
    );

    expect(
      await screen.findByRole('menuitem', { name: 'Plain' }),
    ).not.toBeNull();
    expect(screen.getByText('⇧D')).not.toBeNull();
  });
});

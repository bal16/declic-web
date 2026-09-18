import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render, screen } from '@testing-library/react';

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';

afterEach(() => {
  cleanup();
});

// Smoke coverage for the generated wrapper: renders open content.
describe('Drawer wrappers', () => {
  it('renders every part', async () => {
    render(
      <Drawer defaultOpen>
        <DrawerTrigger>Buka</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Judul</DrawerTitle>
            <DrawerDescription>Deskripsi</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <DrawerClose>Tutup</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>,
    );
    expect(await screen.findByText('Judul')).not.toBeNull();
  });
});

import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render, screen } from '@testing-library/react';

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

afterEach(() => {
  cleanup();
});

// Smoke coverage for the generated wrapper: renders open content.
describe('Sheet wrappers', () => {
  it('renders every part', async () => {
    render(
      <Sheet defaultOpen>
        <SheetTrigger>Buka</SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Judul</SheetTitle>
            <SheetDescription>Deskripsi</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <SheetClose>Tutup</SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>,
    );
    expect(await screen.findByText('Judul')).not.toBeNull();
  });
});

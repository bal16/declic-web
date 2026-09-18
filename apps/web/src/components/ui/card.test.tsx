import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render, screen } from '@testing-library/react';

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

afterEach(() => {
  cleanup();
});

// Smoke coverage for the generated wrapper: renders without crashing.
describe('Card wrappers', () => {
  it('renders every part', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Judul</CardTitle>
          <CardDescription>Deskripsi</CardDescription>
          <CardAction>Aksi</CardAction>
        </CardHeader>
        <CardContent>Isi</CardContent>
        <CardFooter>Kaki</CardFooter>
      </Card>,
    );
    expect(screen.getByText('Judul')).not.toBeNull();
    expect(screen.getByText('Isi')).not.toBeNull();
  });
});

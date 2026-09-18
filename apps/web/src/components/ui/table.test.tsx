import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render, screen } from '@testing-library/react';

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

afterEach(() => {
  cleanup();
});

// Smoke coverage for the generated wrapper: renders without crashing.
describe('Table wrappers', () => {
  it('renders every part', () => {
    render(
      <Table>
        <TableCaption>Keterangan</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Kolom</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Sel</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Kaki</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );
    expect(screen.getByText('Sel')).not.toBeNull();
    expect(screen.getByText('Keterangan')).not.toBeNull();
  });
});

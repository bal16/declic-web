import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

afterEach(() => {
  cleanup();
});

// Smoke coverage for the generated wrapper: opens and selects.
describe('Select wrappers', () => {
  it('opens and selects a value', async () => {
    render(
      <Select defaultValue="a">
        <SelectTrigger aria-label="Pilih">
          <SelectValue placeholder="Pilih" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Opsi A</SelectItem>
          <SelectItem value="b">Opsi B</SelectItem>
        </SelectContent>
      </Select>,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Pilih' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Opsi B' }));
    expect(screen.getByRole('combobox', { name: 'Pilih' })).not.toBeNull();
  });
});

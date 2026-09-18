import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { Toggle } from '@/components/ui/toggle';

afterEach(() => {
  cleanup();
});

// Smoke coverage for the generated wrapper: renders and toggles.
describe('Toggle wrapper', () => {
  it('toggles pressed state on click', () => {
    render(<Toggle aria-label="Alih">A</Toggle>);
    const button = screen.getByRole('button', { name: 'Alih' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
});

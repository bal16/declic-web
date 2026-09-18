import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render, screen } from '@testing-library/react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

afterEach(() => {
  cleanup();
});

// Smoke coverage for the generated wrapper: renders open content.
describe('Tooltip wrappers', () => {
  it('renders trigger and content', async () => {
    render(
      <TooltipProvider>
        <Tooltip defaultOpen>
          <TooltipTrigger>Tombol</TooltipTrigger>
          <TooltipContent>Tip</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByText('Tombol')).not.toBeNull();
    expect(await screen.findByText('Tip')).not.toBeNull();
  });
});

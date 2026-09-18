import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render, screen } from '@testing-library/react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

afterEach(() => {
  cleanup();
});

// Smoke coverage for the generated wrapper: renders without crashing.
describe('Avatar wrappers', () => {
  it('renders image and fallback', () => {
    render(
      <Avatar>
        <AvatarImage src="/avatars/uji.jpg" alt="Uji" />
        <AvatarFallback>UP</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText('UP')).not.toBeNull();
  });
});

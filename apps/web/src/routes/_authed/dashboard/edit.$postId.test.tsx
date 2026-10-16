import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render } from '@testing-library/react';
import type { ComponentType } from 'react';

import { Route } from './edit.$postId';

afterEach(() => {
  cleanup();
});

describe('edit work route', () => {
  it('renders the placeholder', () => {
    const Component = Route.options.component as ComponentType;
    const { getByText } = render(<Component />);
    expect(
      getByText('Hello "/_authed/dashboard/edit/$postId"!'),
    ).not.toBeNull();
  });
});

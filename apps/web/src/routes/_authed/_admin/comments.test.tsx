import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render } from '@testing-library/react';
import type { ComponentType } from 'react';

import { Route } from './comments';

afterEach(() => {
  cleanup();
});

describe('admin comments route', () => {
  it('renders the placeholder', () => {
    const Component = Route.options.component as ComponentType;
    const { getByText } = render(<Component />);
    expect(getByText('Hello "/_admin/comments"!')).not.toBeNull();
  });
});

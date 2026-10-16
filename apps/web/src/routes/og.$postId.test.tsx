import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render } from '@testing-library/react';
import type { ComponentType } from 'react';

import { Route } from './og.$postId';

afterEach(() => {
  cleanup();
});

describe('og image route', () => {
  it('renders the placeholder', () => {
    const Component = Route.options.component as ComponentType;
    const { getByText } = render(<Component />);
    expect(getByText('Hello "/og/"!')).not.toBeNull();
  });
});

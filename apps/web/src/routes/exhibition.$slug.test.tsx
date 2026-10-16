import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render } from '@testing-library/react';
import type { ComponentType } from 'react';

import { Route } from './exhibition.$slug';

afterEach(() => {
  cleanup();
});

describe('exhibition detail route', () => {
  it('renders the placeholder for a slug', () => {
    const Component = Route.options.component as ComponentType;
    const { getByText } = render(<Component />);
    expect(getByText('Hello "/exhibition/"!')).not.toBeNull();
  });
});

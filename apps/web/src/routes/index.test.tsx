import { mock } from 'bun:test';

void mock.module('@/lib/env', () => ({
  getApiUrl: () => 'http://localhost:3001',
}));

import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render } from '@testing-library/react';
import type { ComponentType } from 'react';

import { Route } from './index';

afterEach(() => {
  cleanup();
});

describe('home route', () => {
  it('renders the skeleton copy and api url', () => {
    const Component = Route.options.component as ComponentType;
    const { getByText } = render(<Component />);
    expect(getByText('Dclic')).not.toBeNull();
    expect(getByText(/Momen yang diabadikan/)).not.toBeNull();
    expect(getByText(/http:\/\/localhost:3001/)).not.toBeNull();
  });
});

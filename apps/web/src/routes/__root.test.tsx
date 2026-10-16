import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup } from '@testing-library/react';
import type { ComponentType } from 'react';

import { Route } from './__root';

afterEach(() => {
  cleanup();
});

describe('root route', () => {
  it('defines a root component', () => {
    const Component = Route.options.component as ComponentType;
    expect(typeof Component).toBe('function');
  });
});

import { describe, expect, it } from 'bun:test';

import * as z from 'zod';

import { schema } from './components/data-table';
import { navByRole, sampleTableRows } from './sample-data';

function urlsFor(
  section: keyof (typeof navByRole)[keyof typeof navByRole],
  role: keyof typeof navByRole,
): string[] {
  return navByRole[role][section].map((item) => item.url);
}

function allUrls(role: keyof typeof navByRole): string[] {
  return [
    ...urlsFor('navMain', role),
    ...urlsFor('navSecondary', role),
    ...urlsFor('documents', role),
  ];
}

describe('panel sample data', () => {
  it('table rows satisfy the table schema', () => {
    expect(() => z.array(schema).parse(sampleTableRows)).not.toThrow();
    expect(sampleTableRows.length).toBeGreaterThan(0);
  });

  it('every role can reach the public gallery', () => {
    for (const role of Object.keys(navByRole) as (keyof typeof navByRole)[]) {
      expect(allUrls(role)).toContain('/');
    }
  });

  it('hides privileged areas from insufficient roles', () => {
    expect(allUrls('VIEWER')).not.toContain('/moderation');
    expect(allUrls('VIEWER')).not.toContain('/settings');
    expect(allUrls('VIEWER')).not.toContain('/users');
    expect(allUrls('PHOTOGRAPHER')).not.toContain('/moderation');
    expect(allUrls('PHOTOGRAPHER')).not.toContain('/settings');
    expect(allUrls('CURATOR')).not.toContain('/dashboard');
    expect(allUrls('CURATOR')).not.toContain('/settings');
    expect(allUrls('CURATOR')).not.toContain('/users');
  });

  it('exposes staff and admin areas to sufficient roles', () => {
    expect(allUrls('PHOTOGRAPHER')).toContain('/dashboard');
    expect(allUrls('CURATOR')).toContain('/moderation');
    expect(allUrls('ADMIN')).toContain('/dashboard');
    expect(allUrls('ADMIN')).toContain('/moderation');
    expect(allUrls('ADMIN')).toContain('/settings');
  });
});

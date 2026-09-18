import { expect } from 'bun:test';

import { baseUrl } from '../e2e/setup';

/** GET a page path over real HTTP. */
export async function fetchPage(path: string): Promise<Response> {
  return fetch(`${baseUrl()}${path}`);
}

/** Smoke assertion: page serves 200 with the expected marker text. */
export async function expectOkWithMarker(
  path: string,
  marker: string,
): Promise<void> {
  const res = await fetchPage(path);
  expect(res.status).toBe(200);
  const html = await res.text();
  expect(html).toContain(marker);
}

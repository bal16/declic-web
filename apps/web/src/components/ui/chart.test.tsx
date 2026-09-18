import { afterEach, describe, expect, it } from 'bun:test';

import { cleanup, render } from '@testing-library/react';
import { Area, AreaChart } from 'recharts';

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';

afterEach(() => {
  cleanup();
});

// Smoke coverage for the generated wrapper: renders without crashing.
// (Recharts geometry warnings in happy-dom are expected and harmless.)
describe('Chart wrappers', () => {
  it('renders container and legend', () => {
    const { container } = render(
      <ChartContainer
        config={{ uji: { label: 'Uji', color: 'var(--primary)' } }}
      >
        <AreaChart data={[{ x: 'a', uji: 1 }]}>
          <Area dataKey="uji" />
        </AreaChart>
        <ChartLegend content={<ChartLegendContent />} />
      </ChartContainer>,
    );
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull();
  });
});

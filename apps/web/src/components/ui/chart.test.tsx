import { mock } from 'bun:test';

void mock.module('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
  Tooltip: () => null,
  Legend: () => null,
}));

import { describe, expect, it } from 'bun:test';
import { afterEach } from 'bun:test';

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
  type ChartConfig,
} from './chart';

afterEach(() => {
  cleanup();
});

const config: ChartConfig = {
  revenue: { label: 'Revenue', color: '#f00' },
  visitors: { label: 'Visitors', color: '#0f0' },
};

function payload() {
  return [
    {
      name: 'revenue',
      value: 1200,
      dataKey: 'revenue',
      color: '#f00',
      type: undefined,
      payload: { fill: '#f00' },
    },
  ];
}

describe('ChartContainer', () => {
  it('renders the chart slot with a generated id and children', () => {
    const { container } = render(
      <ChartContainer config={config}>
        <span>child</span>
      </ChartContainer>,
    );
    const slot = container.querySelector('[data-slot="chart"]');
    expect(slot).not.toBeNull();
    expect(slot?.getAttribute('data-chart')).toMatch(/^chart-/);
    expect(screen.getByText('child')).not.toBeNull();
  });

  it('uses the given id when provided', () => {
    const { container } = render(
      <ChartContainer config={config} id="sales">
        <span>child</span>
      </ChartContainer>,
    );
    expect(
      container.querySelector('[data-chart="chart-sales"]'),
    ).not.toBeNull();
  });

  it('emits no style tag for a colorless config', () => {
    const { container } = render(
      <ChartContainer config={{}}>
        <span>child</span>
      </ChartContainer>,
    );
    expect(container.querySelector('style')).toBeNull();
  });

  it('emits css vars for a color config', () => {
    const { container } = render(
      <ChartContainer config={config}>
        <span>child</span>
      </ChartContainer>,
    );
    const style = container.querySelector('style');
    expect(style).not.toBeNull();
    expect(style?.innerHTML).toContain('--color-revenue: #f00');
  });
});

describe('ChartTooltipContent', () => {
  it('throws outside a ChartContainer (useChart guard)', () => {
    expect(() =>
      render(<ChartTooltipContent active payload={payload() as never} />),
    ).toThrow('useChart must be used within a <ChartContainer />');
  });

  it('renders nothing when inactive', () => {
    render(
      <ChartContainer config={config}>
        <ChartTooltipContent active={false} payload={payload() as never} />
      </ChartContainer>,
    );
    expect(screen.queryByText('1,200')).toBeNull();
  });

  it('renders the label and formatted value when active', () => {
    render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          label="revenue"
          payload={payload() as never}
        />
      </ChartContainer>,
    );
    expect(screen.getAllByText('Revenue')).toHaveLength(2);
    expect(screen.getByText('1,200')).not.toBeNull();
  });

  it('uses the labelFormatter when provided', () => {
    render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          label="revenue"
          payload={payload() as never}
          labelFormatter={(value) => `Total ${String(value)}`}
        />
      </ChartContainer>,
    );
    expect(screen.getByText('Total Revenue')).not.toBeNull();
  });

  it('uses the item formatter when provided', () => {
    render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          label="revenue"
          payload={payload() as never}
          formatter={(value) => `~${String(value)}`}
        />
      </ChartContainer>,
    );
    expect(screen.getByText('~1200')).not.toBeNull();
  });

  it('hides the header label when asked (per-item label stays)', () => {
    const { container } = render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          label="revenue"
          payload={payload() as never}
          hideLabel
        />
      </ChartContainer>,
    );
    expect(container.querySelector('div.font-medium')).toBeNull();
    expect(screen.getByText('1,200')).not.toBeNull();
  });

  it('renders the dashed indicator variant', () => {
    const { container } = render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          label="revenue"
          payload={payload() as never}
          indicator="dashed"
        />
      </ChartContainer>,
    );
    expect(container.querySelector('.border-dashed')).not.toBeNull();
  });
});

describe('ChartLegendContent', () => {
  it('renders nothing without payload', () => {
    render(
      <ChartContainer config={config}>
        <ChartLegendContent payload={[]} />
      </ChartContainer>,
    );
    expect(screen.queryByText('Revenue')).toBeNull();
  });

  it('renders legend labels with color dots', () => {
    const { container } = render(
      <ChartContainer config={config}>
        <ChartLegendContent
          payload={[{ dataKey: 'revenue', color: '#f00' }] as never}
        />
      </ChartContainer>,
    );
    expect(screen.getByText('Revenue')).not.toBeNull();
    expect(container.innerHTML).toContain('background-color');
  });

  it('pads the top when aligned to the top', () => {
    const { container } = render(
      <ChartContainer config={config}>
        <ChartLegendContent
          verticalAlign="top"
          payload={[{ dataKey: 'revenue', color: '#f00' }] as never}
        />
      </ChartContainer>,
    );
    expect(container.querySelector('.pb-3')).not.toBeNull();
  });
});

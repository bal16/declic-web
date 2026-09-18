import { afterEach, describe, expect, it } from 'bun:test';

// NOTE: reflects the CURRENT ChartAreaInteractive (props + range switch).
// Data/config shapes will evolve with real query wiring — update fixtures
// here alongside, keep the render-and-switch contract.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { givenChart } from '../../../../../test/factories/panel.factory';
import { stubMatchMedia } from '../../../../../test/setup';
import { ChartAreaInteractive } from './chart-area';

afterEach(() => {
  cleanup();
});

describe('ChartAreaInteractive', () => {
  it('renders the given title, data controls, and no hardcoded copy', () => {
    const { data, config } = givenChart();
    render(
      <ChartAreaInteractive
        data={data}
        config={config}
        title="Pengunjung"
        description="Total 7 hari terakhir"
      />,
    );
    expect(screen.getByText('Pengunjung')).not.toBeNull();
    expect(screen.getByText('Total 7 hari terakhir')).not.toBeNull();
    expect(
      screen.getByRole('button', { name: 'Last 3 months' }),
    ).not.toBeNull();
    expect(screen.queryByText('Total Visitors')).toBeNull();
  });

  it('switches time range without crashing', () => {
    const { data, config } = givenChart();
    render(<ChartAreaInteractive data={data} config={config} />);
    fireEvent.click(screen.getByText('Last 30 days'));
    expect(screen.getByText('Total Visitors')).not.toBeNull();
  });

  it('uses the mobile range and select on small screens', async () => {
    stubMatchMedia(true);
    try {
      const { data, config } = givenChart();
      render(<ChartAreaInteractive data={data} config={config} />);
      const trigger = screen.getByRole('combobox', { name: 'Select a value' });
      fireEvent.click(trigger);
      const opt = await screen.findByRole('option', { name: 'Last 7 days' });
      (opt as HTMLElement).focus();
      fireEvent.keyDown(opt, { key: 'Enter', code: 'Enter' });
      expect(screen.getByText('Total Visitors')).not.toBeNull();
    } finally {
      stubMatchMedia(false);
    }
  });

  it('shows the selected range label, not the raw value', async () => {
    stubMatchMedia(true);
    try {
      const { data, config } = givenChart();
      render(<ChartAreaInteractive data={data} config={config} />);
      const trigger = screen.getByRole('combobox', { name: 'Select a value' });
      fireEvent.click(trigger);
      // Base UI options activate via keyboard, not bare click.
      const opt = await screen.findByRole('option', { name: 'Last 7 days' });
      (opt as HTMLElement).focus();
      fireEvent.keyDown(opt, { key: 'Enter', code: 'Enter' });
      expect(trigger.textContent).toContain('Last 7 days');
      expect(trigger.textContent).not.toContain('7d');
    } finally {
      stubMatchMedia(false);
    }
  });
});

import { afterEach, describe, expect, it } from 'bun:test';

// NOTE: reflects the CURRENT DataTable (default columns/views + sample
// rows). Columns, views, and row shapes will change with real feature
// wiring — update fixtures here alongside, keep the render/select/reorder
// behavior contracts.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import {
  givenTableRow,
  givenTableRows,
} from '../../../../../test/factories/panel.factory';
import { DataTable } from './data-table';

afterEach(() => {
  cleanup();
});

describe('DataTable', () => {
  it('renders rows, views, and pagination from props', () => {
    render(<DataTable data={givenTableRows()} />);
    expect(screen.getByText('Alpha')).not.toBeNull();
    expect(screen.getByText('Beta')).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Outline' })).not.toBeNull();
    expect(screen.getByText('Page 1 of 1')).not.toBeNull();
    expect(screen.getByText('0 of 2 row(s) selected.')).not.toBeNull();
  });

  it('selects a row on checkbox click', () => {
    render(<DataTable data={givenTableRows()} />);
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    fireEvent.click(boxes[1]);
    expect(screen.getByText('1 of 2 row(s) selected.')).not.toBeNull();
  });

  it('shows the empty state without rows', () => {
    render(<DataTable data={[]} />);
    expect(screen.getByText('No results.')).not.toBeNull();
  });

  it('renders the Done status and the reviewer picker', () => {
    render(
      <DataTable
        data={[
          givenTableRow({ id: 1, header: 'Selesai', status: 'Done' }),
          givenTableRow({
            id: 2,
            header: 'Butuh reviewer',
            reviewer: 'Assign reviewer',
          }),
        ]}
      />,
    );
    expect(screen.getByText('Selesai')).not.toBeNull();
    expect(screen.getByText('Butuh reviewer')).not.toBeNull();
  });

  it('submits the target form without crashing', () => {
    render(<DataTable data={givenTableRows()} />);
    const input = screen.getAllByLabelText('Target')[0];
    const form = input.closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);
    expect(screen.getByText('Alpha')).not.toBeNull();
  });

  it('opens the row actions menu', async () => {
    render(<DataTable data={givenTableRows()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Open menu' })[0]);
    expect(
      await screen.findByRole('menuitem', { name: 'Delete' }),
    ).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).not.toBeNull();
  });

  it('toggles a column off via Customize Columns', async () => {
    render(<DataTable data={givenTableRows()} />);
    fireEvent.click(screen.getByRole('button', { name: /Customize Columns/ }));
    const item = await screen.findByRole('menuitemcheckbox', {
      name: 'type',
    });
    fireEvent.click(item);
    expect(screen.queryByText('Section Type')).toBeNull();
  });

  it('changes rows per page', async () => {
    render(<DataTable data={givenTableRows()} />);
    const rowsPerPage = document.getElementById('rows-per-page');
    if (!rowsPerPage) throw new Error('expected rows-per-page to render');
    fireEvent.click(rowsPerPage);
    fireEvent.click(await screen.findByRole('option', { name: '20' }));
    expect(screen.getByText('Page 1 of 1')).not.toBeNull();
  });

  it('shows the selected view label, not the raw value', async () => {
    render(<DataTable data={givenTableRows()} />);
    const viewSelector = document.getElementById('view-selector');
    if (!viewSelector) throw new Error('expected view-selector to render');
    fireEvent.click(viewSelector);
    // Base UI options activate via keyboard, not bare click.
    const opt = await screen.findByRole('option', { name: 'Key Personnel' });
    (opt as HTMLElement).focus();
    fireEvent.keyDown(opt, { key: 'Enter', code: 'Enter' });
    const trigger = document.getElementById('view-selector');
    if (!trigger) throw new Error('expected view-selector to render');
    expect(trigger.textContent).toContain('Key Personnel');
    expect(trigger.textContent).not.toContain('key-personnel');
  });
});

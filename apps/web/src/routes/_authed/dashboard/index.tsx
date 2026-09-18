import { createFileRoute } from '@tanstack/react-router';

import {
  PHOTOGRAPHER_ROLES,
  requireRoles,
} from '@/features/shared/auth/guards';
import { ChartAreaInteractive } from '@/features/shared/panel/components/chart-area';
import { DataTable } from '@/features/shared/panel/components/data-table';
import {
  sampleChartConfig,
  sampleChartData,
  sampleTableRows,
} from '@/features/shared/panel/sample-data';

export const Route = createFileRoute('/_authed/dashboard/')({
  beforeLoad: () => requireRoles(PHOTOGRAPHER_ROLES),
  staticData: { title: 'Dashboard' },
  component: RouteComponent,
});

// TEMPORARY: sample content sampai loader TanStack Query mendarat.
// Guards live in beforeLoad above (session wall in _authed layout +
// PHOTOGRAPHER|ADMIN here).
function RouteComponent() {
  return (
    <>
      <ChartAreaInteractive
        data={sampleChartData}
        config={sampleChartConfig}
        title="Pengunjung"
        description="Total 7 hari terakhir"
      />
      <DataTable data={sampleTableRows} />
    </>
  );
}

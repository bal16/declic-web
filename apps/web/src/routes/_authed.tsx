import { Outlet, createFileRoute, useMatches } from '@tanstack/react-router';
import type { CSSProperties } from 'react';

import { ModeToggle } from '@/components/mode-toggle';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { requireSession } from '@/features/shared/auth/guards';
import { useSessionRole } from '@/features/shared/auth/session';
import { Header } from '@/features/shared/panel/components/header';
import { AppSidebar } from '@/features/shared/panel/components/sidebar';
import {
  navByRole,
  sampleBrandName,
  sampleUser,
  sampleUserMenuItems,
} from '@/features/shared/panel/sample-data';

export const Route = createFileRoute('/_authed')({
  beforeLoad: () => requireSession(),
  component: RouteComponent,
});

// PATHLESS layout: no URL segment. Session wall runs in beforeLoad
// (anonymous → /login); the shared panel shell renders here so every
// authed area inherits it. Page titles come from each page's
// staticData.title.
function RouteComponent() {
  const role = useSessionRole() ?? 'VIEWER';
  const matches = useMatches();
  const title =
    [...matches]
      .reverse()
      .find(
        (m): m is typeof m & { staticData: { title: string } } =>
          typeof (m.staticData as { title?: unknown } | undefined)?.title ===
          'string',
      )?.staticData.title ?? sampleBrandName;
  const nav = navByRole[role];

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as CSSProperties
      }
    >
      <AppSidebar
        user={sampleUser}
        brandName={sampleBrandName}
        navMain={nav.navMain}
        navSecondary={nav.navSecondary}
        documents={nav.documents}
        userMenuItems={sampleUserMenuItems}
        variant="inset"
      />
      <SidebarInset>
        <Header title={title} actions={<ModeToggle />} />
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

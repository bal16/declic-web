import { ProhibitInsetIcon, type Icon } from '@phosphor-icons/react';
import { Activity, type ComponentProps } from 'react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

import { NavDocuments } from './nav-documents';
import { NavMain } from './nav-main';
import { NavSecondary } from './nav-secondary';
import { NavUser, type PanelUser, type UserMenuItem } from './nav-user';

export interface SidebarNavItem {
  title: string;
  url: string;
  icon?: Icon;
}

export interface SidebarDocumentItem {
  name: string;
  url: string;
  icon: Icon;
}

interface AppSidebarProps extends ComponentProps<typeof Sidebar> {
  user: PanelUser;
  brandName: string;
  brandHref?: string;
  navMain: SidebarNavItem[];
  navSecondary: SidebarNavItem[];
  documents: SidebarDocumentItem[];
  userMenuItems: UserMenuItem[];
}

export function AppSidebar({
  user,
  brandName,
  brandHref = '#',
  navMain,
  navSecondary,
  documents,
  userMenuItems,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={(props) => (
                <a href={brandHref} {...props}>
                  <ProhibitInsetIcon className="size-5!" />
                  <span className="text-base font-semibold">{brandName}</span>
                </a>
              )}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <Activity mode={navMain.length > 0 ? 'visible' : 'hidden'}>
          <NavMain items={navMain} />
        </Activity>
        <Activity mode={documents.length > 0 ? 'visible' : 'hidden'}>
          <NavDocuments items={documents} />
        </Activity>
        <Activity mode={navSecondary.length > 0 ? 'visible' : 'hidden'}>
          <NavSecondary items={navSecondary} className="mt-auto" />
        </Activity>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} menuItems={userMenuItems} />
      </SidebarFooter>
    </Sidebar>
  );
}

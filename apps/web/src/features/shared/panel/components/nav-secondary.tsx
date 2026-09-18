import type { Icon } from '@phosphor-icons/react';
import { Link, useLocation } from '@tanstack/react-router';
import type { ComponentPropsWithoutRef } from 'react';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

interface NavSecondaryProps extends ComponentPropsWithoutRef<
  typeof SidebarGroup
> {
  items: {
    title: string;
    url: string;
    icon?: Icon;
  }[];
}

export function NavSecondary({ items, ...props }: NavSecondaryProps) {
  const pathname = useLocation({ select: (s) => s.pathname });
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                isActive={pathname === item.url}
                render={(props) => (
                  <Link to={item.url} {...props}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </Link>
                )}
              />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

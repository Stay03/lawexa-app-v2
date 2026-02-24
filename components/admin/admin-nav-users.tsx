'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users,
  ChevronRight,
  List,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';

const userNavItems = [
  { title: 'All Users', url: '/admin/users', icon: List },
  { title: 'Analytics', url: '/admin/users/analytics', icon: BarChart3 },
  { title: 'Lawyer Verifications', url: '/admin/lawyer-verifications', icon: ShieldCheck },
];

export function AdminNavUsersSection() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const isSectionActive =
    pathname.startsWith('/admin/users') ||
    pathname.startsWith('/admin/lawyer-verifications');

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Users</SidebarGroupLabel>
      <SidebarMenu>
        <Collapsible defaultOpen={isSectionActive} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip="Users" isActive={isSectionActive}>
                <Users />
                <span>Users</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {userNavItems.map((item) => {
                  const isActive =
                    pathname === item.url ||
                    pathname.startsWith(item.url + '/');
                  return (
                    <SidebarMenuSubItem key={item.title}>
                      <SidebarMenuSubButton asChild isActive={isActive}>
                        <Link
                          href={item.url}
                          onClick={() => setOpenMobile(false)}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      </SidebarMenu>
    </SidebarGroup>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  LayoutDashboard,
  FileText,
  FileSearch,
  Radar,
  FileCode2,
  CalendarClock,
  ChevronRight,
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
import { useAuth } from '@/lib/hooks/useAuth';

interface OpsNavItem {
  title: string;
  url: string;
  icon: typeof Activity;
  exact?: boolean;
  superadminOnly?: boolean;
}

const opsNavItems: OpsNavItem[] = [
  { title: 'Overview', url: '/admin/operations', icon: LayoutDashboard, exact: true },
  { title: 'Case Ingestions', url: '/admin/operations/case-ingestions', icon: FileText },
  { title: 'File Extractions', url: '/admin/operations/file-extractions', icon: FileSearch },
  { title: 'Radar Scans', url: '/admin/operations/radar-scans', icon: Radar },
  { title: 'Statute Imports', url: '/admin/operations/statute-imports', icon: FileCode2 },
  {
    title: 'Scheduled Tasks',
    url: '/admin/operations/scheduled-tasks',
    icon: CalendarClock,
    superadminOnly: true,
  },
];

export function AdminNavOperationsSection() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';

  const items = opsNavItems.filter((item) => !item.superadminOnly || isSuperadmin);
  const isSectionActive = pathname.startsWith('/admin/operations');

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Operations</SidebarGroupLabel>
      <SidebarMenu>
        <Collapsible defaultOpen={isSectionActive} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip="Operations" isActive={isSectionActive}>
                <Activity />
                <span>Operations</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {items.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.url
                    : pathname === item.url || pathname.startsWith(item.url + '/');
                  return (
                    <SidebarMenuSubItem key={item.title}>
                      <SidebarMenuSubButton asChild isActive={isActive}>
                        <Link href={item.url} onClick={() => setOpenMobile(false)}>
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

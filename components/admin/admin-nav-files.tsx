'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FolderOpen,
  ChevronRight,
  Files,
  BarChart3,
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

const filesNavItems = [
  {
    title: 'All Files',
    url: '/admin/files',
    icon: Files,
    excludePaths: ['/admin/files/analytics'],
  },
  {
    title: 'File Analytics',
    url: '/admin/files/analytics',
    icon: BarChart3,
  },
];

export function AdminNavFilesSection() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const isSectionActive = pathname.startsWith('/admin/files');

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Files</SidebarGroupLabel>
      <SidebarMenu>
        <Collapsible defaultOpen={isSectionActive} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip="Files" isActive={isSectionActive}>
                <FolderOpen />
                <span>Files</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {filesNavItems.map((item) => {
                  const baseActive =
                    pathname === item.url || pathname.startsWith(item.url + '/');
                  const isExcluded = item.excludePaths?.some(
                    (p: string) => pathname === p || pathname.startsWith(p + '/')
                  );
                  const isActive = baseActive && !isExcluded;
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

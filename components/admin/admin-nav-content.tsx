'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  ChevronRight,
  MessageSquareQuote,
  Scale,
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

const contentNavItems = [
  { title: 'Content Requests', url: '/admin/content-requests', icon: MessageSquareQuote },
  { title: 'Cases', url: '/admin/cases', icon: Scale },
];

export function AdminNavContentSection() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const isSectionActive = pathname.startsWith('/admin/content-requests') || pathname.startsWith('/admin/cases');

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Content</SidebarGroupLabel>
      <SidebarMenu>
        <Collapsible defaultOpen={isSectionActive} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip="Content" isActive={isSectionActive}>
                <FileText />
                <span>Content</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {contentNavItems.map((item) => {
                  const isActive = pathname === item.url || pathname.startsWith(item.url + '/');
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

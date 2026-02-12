'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageSquare,
  ChevronRight,
  List,
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

const conversationNavItems = [
  { title: 'All Conversations', url: '/admin/conversations', icon: List },
  { title: 'Analytics', url: '/admin/conversations/analytics', icon: BarChart3 },
];

export function AdminNavConversationsSection() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const isSectionActive = pathname.startsWith('/admin/conversations');

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Conversations</SidebarGroupLabel>
      <SidebarMenu>
        <Collapsible defaultOpen={isSectionActive} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip="Conversations" isActive={isSectionActive}>
                <MessageSquare />
                <span>Conversations</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {conversationNavItems.map((item) => {
                  const isActive = pathname === item.url;
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

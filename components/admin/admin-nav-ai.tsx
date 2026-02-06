'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Brain,
  ChevronRight,
  Server,
  Box,
  Bot,
  Wrench,
  GitBranch,
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

const aiNavItems = [
  { title: 'Providers', url: '/admin/ai/providers', icon: Server },
  { title: 'Models', url: '/admin/ai/models', icon: Box },
  { title: 'Agents', url: '/admin/ai/agents', icon: Bot },
  { title: 'Tools', url: '/admin/ai/tools', icon: Wrench },
  { title: 'Workflows', url: '/admin/ai/workflows', icon: GitBranch },
];

export function AdminNavAiSection() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const isAiSectionActive = pathname.startsWith('/admin/ai');

  return (
    <SidebarGroup>
      <SidebarGroupLabel>AI Management</SidebarGroupLabel>
      <SidebarMenu>
        <Collapsible defaultOpen={isAiSectionActive} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip="AI Management" isActive={isAiSectionActive}>
                <Brain />
                <span>AI</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {aiNavItems.map((item) => {
                  const isActive = pathname.startsWith(item.url);
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

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  ChevronRight,
  MessageSquareQuote,
  Scale,
  Bell,
  Send,
  BarChart3,
  Eye,
  Handshake,
  BookOpen,
  Upload,
  GraduationCap,
  Library,
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
  { title: 'Ambassadors', url: '/admin/ambassadors', icon: GraduationCap },
  { title: 'Cases', url: '/admin/cases', icon: Scale },
  { title: 'Courses', url: '/admin/courses', icon: Library },
  { title: 'Statutes', url: '/admin/statutes', icon: BookOpen, excludePaths: ['/admin/statutes/import'] },
  { title: 'Import Statute', url: '/admin/statutes/import', icon: Upload },
  { title: 'All Broadcasts', url: '/admin/notifications', icon: Bell, excludePaths: ['/admin/notifications/broadcast', '/admin/notifications/analytics'] },
  { title: 'Send Broadcast', url: '/admin/notifications/broadcast', icon: Send },
  { title: 'Notif. Analytics', url: '/admin/notifications/analytics', icon: BarChart3 },
  { title: 'Views Analytics', url: '/admin/views/analytics', icon: Eye },
  { title: 'Connections', url: '/admin/lawyer-connect', icon: Handshake, excludePaths: ['/admin/lawyer-connect/analytics'] },
  { title: 'Connect Analytics', url: '/admin/lawyer-connect/analytics', icon: BarChart3 },
];

export function AdminNavContentSection() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const isSectionActive = pathname.startsWith('/admin/content-requests') || pathname.startsWith('/admin/ambassadors') || pathname.startsWith('/admin/cases') || pathname.startsWith('/admin/courses') || pathname.startsWith('/admin/statutes') || pathname.startsWith('/admin/notifications') || pathname.startsWith('/admin/views') || pathname.startsWith('/admin/lawyer-connect');

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
                  const baseActive = pathname === item.url || pathname.startsWith(item.url + '/');
                  const isExcluded = item.excludePaths?.some((p: string) => pathname === p || pathname.startsWith(p + '/'));
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

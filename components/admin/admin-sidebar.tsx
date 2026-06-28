'use client';

import * as React from 'react';
import {
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { AdminNavConversationsSection } from '@/components/admin/admin-nav-conversations';
import { AdminNavUsersSection } from '@/components/admin/admin-nav-users';
import { AdminNavContentSection } from '@/components/admin/admin-nav-content';
import { AdminNavQuizSection } from '@/components/admin/admin-nav-quiz';
import { AdminNavBillingSection } from '@/components/admin/admin-nav-billing';
import { AdminNavAiSection } from '@/components/admin/admin-nav-ai';
import { AdminNavFilesSection } from '@/components/admin/admin-nav-files';
import { NavUser } from '@/components/layout/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';

export function AdminSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="group-data-[collapsible=icon]:hidden"
            >
              <Link href="/admin" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold">Lawexa Admin</span>
                  <span className="text-xs text-muted-foreground">
                    Management Console
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
            <SidebarMenuButton
              size="lg"
              asChild
              className="hidden group-data-[collapsible=icon]:flex"
            >
              <Link href="/admin">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="flex flex-col gap-0">
        <AdminNavConversationsSection />
        <AdminNavUsersSection />
        <AdminNavContentSection />
        <AdminNavQuizSection />
        <AdminNavFilesSection />
        <AdminNavBillingSection />
        <AdminNavAiSection />
        <AdminNavSystemSection />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function AdminNavSystemSection() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const isActive = pathname === '/admin/settings' || pathname.startsWith('/admin/settings/');

  return (
    <SidebarGroup>
      <SidebarGroupLabel>System</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="Settings" isActive={isActive}>
            <Link href="/admin/settings" onClick={() => setOpenMobile(false)}>
              <SlidersHorizontal />
              <span>Settings</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}

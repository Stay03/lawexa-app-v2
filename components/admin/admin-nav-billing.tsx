'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CreditCard,
  ChevronRight,
  BarChart3,
  List,
  Layers,
  Package,
  Settings,
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

const billingNavItems = [
  { title: 'Plans', url: '/admin/plans', icon: Layers, exact: true },
  { title: 'Subscriptions', url: '/admin/subscriptions', icon: List, exact: true },
  { title: 'Sub. Analytics', url: '/admin/subscriptions/analytics', icon: BarChart3 },
  { title: 'Message Packs', url: '/admin/message-packs', icon: Package, exact: true },
  { title: 'Pack Analytics', url: '/admin/message-packs/analytics', icon: BarChart3 },
  { title: 'Settings', url: '/admin/billing/settings', icon: Settings },
];

export function AdminNavBillingSection() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const isSectionActive = pathname.startsWith('/admin/plans') || pathname.startsWith('/admin/subscriptions') || pathname.startsWith('/admin/message-packs') || pathname.startsWith('/admin/billing');

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Billing</SidebarGroupLabel>
      <SidebarMenu>
        <Collapsible defaultOpen={isSectionActive} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton tooltip="Billing" isActive={isSectionActive}>
                <CreditCard />
                <span>Billing</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {billingNavItems.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.url || (pathname.startsWith(item.url + '/') && !pathname.startsWith(item.url + '/analytics'))
                    : pathname === item.url || pathname.startsWith(item.url + '/');
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

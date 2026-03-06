'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CreditCard,
  ChevronRight,
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

const billingNavItems = [
  { title: 'Sub. Analytics', url: '/admin/subscriptions/analytics', icon: BarChart3 },
];

export function AdminNavBillingSection() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const isSectionActive = pathname.startsWith('/admin/subscriptions');

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

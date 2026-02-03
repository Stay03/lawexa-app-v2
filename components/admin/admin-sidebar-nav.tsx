'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MessageSquare,
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
  exactMatch?: boolean;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    description: 'Overview and statistics',
    href: '/admin',
    icon: LayoutDashboard,
    comingSoon: true,
    exactMatch: true,
  },
  {
    label: 'Conversations',
    description: 'View all user conversations',
    href: '/admin/conversations',
    icon: MessageSquare,
  },
  {
    label: 'Users',
    description: 'Manage user accounts',
    href: '/admin/users',
    icon: Users,
    comingSoon: true,
  },
  {
    label: 'Analytics',
    description: 'Usage metrics and insights',
    href: '/admin/analytics',
    icon: BarChart3,
    comingSoon: true,
  },
  {
    label: 'Settings',
    description: 'Platform configuration',
    href: '/admin/settings',
    icon: Settings,
    comingSoon: true,
  },
];

export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 md:w-60 md:shrink-0">
      {navItems.map((item) => {
        const isActive = item.exactMatch
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;

        const content = (
          <>
            <Icon className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{item.label}</span>
                {item.comingSoon && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    Soon
                  </Badge>
                )}
              </div>
              <div
                className={cn(
                  'hidden md:block text-xs',
                  isActive
                    ? 'text-primary-foreground/80'
                    : 'text-muted-foreground'
                )}
              >
                {item.description}
              </div>
            </div>
          </>
        );

        if (item.comingSoon) {
          return (
            <div
              key={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm whitespace-nowrap md:whitespace-normal cursor-not-allowed opacity-60',
                'text-muted-foreground'
              )}
            >
              {content}
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors whitespace-nowrap md:whitespace-normal',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

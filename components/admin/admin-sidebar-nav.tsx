'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    label: 'Conversations',
    description: 'View all user conversations',
    href: '/admin/conversations',
    icon: MessageSquare,
  },
  // Extensible: Add more admin sections here
  // {
  //   label: 'Users',
  //   description: 'Manage user accounts',
  //   href: '/admin/users',
  //   icon: Users,
  // },
];

export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 md:w-60 md:shrink-0">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;

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
            <Icon className="h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium">{item.label}</div>
              <div
                className={cn(
                  'hidden md:block text-xs',
                  isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                )}
              >
                {item.description}
              </div>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

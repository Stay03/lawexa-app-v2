'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  User,
  Settings,
  Paintbrush,
  Bell,
  Lock,
  Link as LinkIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    label: 'Profile',
    description: 'Manage your professional profile',
    href: '/settings/profile',
    icon: User,
  },
  {
    label: 'Account',
    description: 'Basic account settings',
    href: '/settings/account',
    icon: Settings,
  },
  {
    label: 'Appearance',
    description: 'Theme and display preferences',
    href: '/settings/appearance',
    icon: Paintbrush,
  },
  {
    label: 'Notifications',
    description: 'Email and push notifications',
    href: '/settings/notifications',
    icon: Bell,
  },
  {
    label: 'Privacy & Security',
    description: 'Privacy settings and security',
    href: '/settings/privacy',
    icon: Lock,
  },
  {
    label: 'API',
    description: 'API keys and integrations',
    href: '/settings/api',
    icon: LinkIcon,
  },
];

export function SettingsSidebarNav() {
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

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  Scale,
  FileText,
  Bookmark,
  LayoutDashboard,
  Settings,
  Users,
  LucideIcon,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: string[];
}

const mainNavItems: NavItem[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/cases', label: 'Cases', icon: Scale },
  { href: '/notes', label: 'Notes', icon: FileText },
  { href: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

const settingsNavItems: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/admin', label: 'Admin', icon: Users, roles: ['admin', 'superadmin'] },
];

interface SidebarNavProps {
  userRole?: string;
  onItemClick?: () => void;
}

function SidebarNav({ userRole, onItemClick }: SidebarNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const filterByRole = (items: NavItem[]) => {
    return items.filter((item) => {
      if (!item.roles) return true;
      if (!userRole) return false;
      return item.roles.includes(userRole);
    });
  };

  return (
    <nav className="flex flex-col gap-1">
      <div className="mb-2">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Menu
        </p>
        {mainNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive(item.href)
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Settings
        </p>
        {filterByRole(settingsNavItems).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive(item.href)
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default SidebarNav;
export { SidebarNav };

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  User,
  Settings,
  CreditCard,
  MessageSquarePlus,
  Paintbrush,
  Bell,
  Lock,
  Link as LinkIcon,
  Gauge,
  Building2,
  FlaskConical,
  Ticket,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/authStore';
import { ambassadorsApi } from '@/lib/api/ambassadors';
import { canAccessSpaces } from '@/lib/utils/spaces-access';
import { canAccessV2Preview } from '@/lib/utils/v2-access';

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
    label: 'Organization',
    description: 'Your organization & verification',
    href: '/settings/organization',
    icon: Building2,
  },
  {
    label: 'Usage',
    description: 'Plan limits and message balance',
    href: '/settings/usage',
    icon: Gauge,
  },
  {
    label: 'Billing',
    description: 'Subscription and invoices',
    href: '/settings/billing',
    icon: CreditCard,
  },
  {
    label: 'Message Packs',
    description: 'Buy additional AI messages',
    href: '/settings/message-packs',
    icon: MessageSquarePlus,
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
  {
    label: 'Referrals',
    description: 'Your ambassador code and link',
    href: '/settings/referrals',
    icon: Ticket,
  },
  {
    label: 'Developer',
    description: 'Preview builds & flags',
    href: '/settings/developer',
    icon: FlaskConical,
  },
];

export function SettingsSidebarNav() {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);
  // Organization is part of the soft-launched Spaces feature (privileged roles
  // only). Developer holds the v2-preview toggle — open to every registered
  // account since Aug 3, 2026; only guests/bots are filtered out.
  const canSpaces = canAccessSpaces(role);
  const canV2Preview = canAccessV2Preview(role);

  /**
   * ── REFERRALS CANNOT BE FILTERED ON A ROLE, BECAUSE THERE ISN'T ONE ────────
   * Every other row here is decided by `role`, which arrives with the session
   * and costs nothing. An ambassador is not a role and deliberately never will
   * be — roles are a priority ladder where each check asks "at least X", so
   * inserting one changes the meaning of every existing check for somebody
   * whose abilities do not change. An ambassador is an ordinary user with an
   * APPROVED application, and only the server knows that.
   *
   * So this one row costs a request. It is kept cheap and quiet:
   *  - a long `staleTime`, because an application is approved once and does not
   *    change while somebody clicks around their settings;
   *  - the same query key the referral screen itself uses, so opening the page
   *    reuses this answer instead of asking again;
   *  - and the row simply is not rendered until the answer arrives, rather than
   *    being rendered disabled or reserved — a settings list that shifts under
   *    the cursor is worse than one that finishes assembling.
   */
  const application = useQuery({
    queryKey: ['ambassador-application'],
    queryFn: () => ambassadorsApi.getMyApplication(),
    staleTime: 5 * 60 * 1000,
  });
  const isAmbassador = application.data?.data?.status === 'approved';

  const items = navItems.filter((item) => {
    if (item.href === '/settings/organization') return canSpaces;
    if (item.href === '/settings/developer') return canV2Preview;
    if (item.href === '/settings/referrals') return isAmbassador;
    return true;
  });

  return (
    <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 md:w-60 md:shrink-0">
      {items.map((item) => {
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

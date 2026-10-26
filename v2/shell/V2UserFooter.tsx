'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { FileText, LogOut, Moon, Settings, Shield, ShieldCheck, Sun, SunMoon, Tag, UserRound } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { SignOutConfirm } from '@/v2/features/settings/sign-out/SignOutConfirm';
import { subscriptionQueries } from '@/v2/features/subscription/queries';
import type { SessionUser } from '@/v2/runtime/session';
import { FOCUS_RING } from './designs/modules';
import { useMounted } from './use-mounted';

/**
 * V2UserFooter — the real account row for the sidebar + drawer footers,
 * replacing the hardcoded "AO / Adaeze Okafor / Premium" placeholder.
 *
 * Identity comes from the server-verified session (threaded as a prop from the
 * layout — clean server→client threading), so the name/avatar are correct on
 * first paint with no client auth round-trip. The plan line is the ONLY thing
 * fetched client-side: `subscriptionQueries.current()` gated to signed-in users,
 * mirroring v1's `plan?.name ?? 'Free'` semantics.
 *
 * THE HANDLE IS HERE, AND SO IS THE WAY TO SET ONE. A `@username` is what tags
 * a person (digest §F.19); this row is the product's account card, the one
 * surface that answers "what do people type to reach me?" — see the house rule
 * in `v2/features/channels/model.ts` for the full list of surfaces that earn a
 * handle. It sits beside the plan because both are quiet facts ABOUT the
 * account rather than the account's name, and because a third line would make a
 * footer of a footer. Known from the session, so it paints immediately while
 * the plan is still resolving.
 *
 * WITHOUT ONE, THIS ROW IS THE ONLY DOOR v2 HAS. Handles are set on the profile
 * screen, which v2 has not rebuilt and must not rebuild for this — so the row
 * became a link to `/settings/profile` (the same cross-tree linking the shell
 * already does for `/settings/developer` and `/settings/message-packs`), and
 * "Set a handle" takes the handle's place until there is one. That matters
 * today rather than in principle: with the backfill unrun, EVERY account has
 * `username: null`, so the channel mention picker's entire content is "…can't
 * be tagged yet", and this is the sentence that ends it. It retires itself the
 * moment a handle exists.
 *
 * Signed out OR a guest → the two doors into an account, never the account row.
 * See the guest note in the body for why a guest is not simply a signed-in user
 * with fewer permissions here.
 *
 * ── THE ROW OPENS A SHORT MENU (Stay, 26 October 2026) ─────────────────────
 * "that profile area at the bottom should show the options like in v1 but few
 * since settings have everything, keep the upgrade button there too". v1's
 * menu (components/layout/nav-user.tsx) held ten rows; Settings now holds
 * Usage, Billing, Activity and the legal documents, so this one keeps the few
 * a reader reaches for from anywhere: Profile (where the handle is set),
 * Settings, Theme, Admin for an admin, the privacy policy and terms, and Sign
 * out (Stay approved the list, 03:51 UTC). Theme and Settings came
 * here from the bar's ⋮, which now carries only a screen's own actions.
 * Pricing follows Settings for every account (Stay, 08:36 UTC: "Add pricing
 * to that menu"): a paid reader may want to compare or change plan.
 *
 * UPGRADE sits beside the row for a free account, as v1's did, and only once
 * the plan has loaded, so a paid account never sees it flash.
 */
export function V2UserFooter({
  user,
  className,
  onNavigate,
}: {
  user: SessionUser | null;
  className?: string;
  /** The drawer's dismiss — its own nav rows call it on click, and this row is
   *  a nav row now. It takes where the row goes: the drawer closes at once for
   *  the page on screen and after another page has painted (drawer-close.ts).
   *  The persistent sidebar passes nothing. */
  onNavigate?: (href: string) => void;
}) {
  /**
   * A GUEST IS NOT AN ACCOUNT, AND THIS ROW WAS TREATING IT AS ONE.
   *
   * Reported by @arthur on 2026-08-13 with a screenshot: a guest opening the
   * drawer saw "Guest User · Set a handle · Free" and no way to sign up or sign
   * in ANYWHERE. The bug is the `!user` test below — a guest has a session, so
   * it fell through to the account row and was offered the one thing a guest
   * can never do. Guest accounts are view-only until they register, so there is
   * no profile to open and no handle to set.
   *
   * Both doors are offered, not one. A guest arrived here without an account,
   * so registering is the likely intent and leads; somebody who already has an
   * account and is browsing signed-out needs the quieter second door.
   */
  const isGuest = user?.role === 'guest';
  const mounted = useMounted();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [signOutOpen, setSignOutOpen] = useState(false);

  const planQuery = useQuery({
    ...subscriptionQueries.current(),
    // A guest has no subscription to read, so this asked a question nobody
    // needed the answer to on every drawer open.
    enabled: !!user && !isGuest,
  });

  if (!user || isGuest) {
    return (
      <div className={cn('grid gap-1.5', className)}>
        <Button asChild className="w-full">
          <Link href="/register" onClick={() => onNavigate?.('/register')}>
            Create account
          </Link>
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link href="/login" onClick={() => onNavigate?.('/login')}>
            Sign in
          </Link>
        </Button>
        {/* Settings stays one press away without an account: Appearance and
            notifications work for a guest, and the bar's ⋮ that used to hold
            this door now carries only a screen's own actions. */}
        <Link
          href="/settings"
          onClick={() => onNavigate?.('/settings')}
          className={cn(
            'v2-interactive flex min-h-9 items-center justify-center gap-1.5 rounded-md text-xs text-muted-foreground',
            'transition-colors duration-150 hover:text-foreground motion-reduce:transition-none',
            FOCUS_RING,
          )}
        >
          <Settings aria-hidden className="size-3.5" />
          Settings
        </Link>
      </div>
    );
  }

  // Plan resolves after first paint — show a skeleton, then cross-fade to the
  // real plan name (skeleton-first rule #23; never a placeholder-string flash).
  const planName = planQuery.data?.data?.plan?.name;

  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  // Missing plan data counts as free, as in v1; nothing shows until it loads.
  const showUpgrade = planQuery.isSuccess && planQuery.data?.data?.is_free_tier !== false;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            // NO `aria-label`. The row's own content — name, handle (or "Set a
            // handle") and plan — is the honest accessible name; overriding it
            // with a tidier sentence would delete two of those three facts for
            // the readers least able to get them elsewhere.
            className={cn(
              'v2-interactive flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left',
              'transition-colors duration-150 hover:bg-muted data-[state=open]:bg-muted motion-reduce:transition-none',
              FOCUS_RING,
            )}
          >
            <Avatar className="size-8">
              <AvatarImage src={user.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {initialsOf(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left leading-tight">
              <span className="truncate text-sm font-medium text-foreground">
                {user.name}
              </span>
              {/* A DIV, not a span: `Skeleton` renders a div, and a div inside a span
                  is invalid markup React will fight over at hydration. */}
              <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <span
                  className={cn(
                    'min-w-0 truncate',
                    // Not gold-as-decoration: without a handle nobody can tag this
                    // person at all, so the accent is doing its one job — this
                    // concerns you.
                    !user.username && 'font-medium text-primary',
                  )}
                >
                  {user.username ? `@${user.username}` : 'Set a handle'}
                </span>
                {/* The plan, unless Upgrade sits beside the row: that already
                    says "free", and the pill's width would cut the handle and
                    the plan both ("@bannertest… · Fr…" on a computer). */}
                {showUpgrade ? null : (
                  <>
                    <span aria-hidden className="shrink-0">
                      ·
                    </span>
                    {planQuery.isPending ? (
                      <Skeleton className="h-3 w-14 shrink-0 rounded" />
                    ) : (
                      <span className="min-w-0 truncate motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
                        {planName ?? 'Free'}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-56">
          <DropdownMenuItem asChild className="min-h-11 md:min-h-8">
            <Link href="/settings/profile" onClick={() => onNavigate?.('/settings/profile')}>
              <UserRound className="text-muted-foreground" />
              <span>Profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="min-h-11 md:min-h-8">
            <Link href="/settings" onClick={() => onNavigate?.('/settings')}>
              <Settings className="text-muted-foreground" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="min-h-11 md:min-h-8">
            <Link href="/pricing" onClick={() => onNavigate?.('/pricing')}>
              <Tag className="text-muted-foreground" />
              <span>Pricing</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11 md:min-h-8"
            // Keep the menu open so the state flip is visible in place.
            onSelect={(event) => {
              event.preventDefault();
              setTheme(isDark ? 'light' : 'dark');
            }}
          >
            {!mounted ? (
              <SunMoon className="text-muted-foreground" />
            ) : isDark ? (
              <Moon className="text-muted-foreground" />
            ) : (
              <Sun className="text-muted-foreground" />
            )}
            <span className="flex-1">Theme</span>
            {mounted ? (
              <span className="text-xs text-muted-foreground">{isDark ? 'Dark' : 'Light'}</span>
            ) : null}
          </DropdownMenuItem>
          {isAdmin ? (
            <DropdownMenuItem asChild className="min-h-11 md:min-h-8">
              {/* A plain link: the admin pages are in the classic app only, so
                  the address is loaded, not routed inside this one. */}
              <a href="/admin">
                <Shield className="text-muted-foreground" />
                <span>Admin</span>
              </a>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="min-h-11 md:min-h-8">
            <Link href="/privacy" onClick={() => onNavigate?.('/privacy')}>
              <ShieldCheck className="text-muted-foreground" />
              <span>Privacy policy</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="min-h-11 md:min-h-8">
            <Link href="/terms" onClick={() => onNavigate?.('/terms')}>
              <FileText className="text-muted-foreground" />
              <span>Terms of service</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="min-h-11 md:min-h-8" onSelect={() => setSignOutOpen(true)}>
            <LogOut className="text-muted-foreground" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showUpgrade ? (
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-8 shrink-0 rounded-full px-3 text-xs font-medium motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          <Link href="/pricing" onClick={() => onNavigate?.('/pricing')}>
            Upgrade
          </Link>
        </Button>
      ) : null}

      <SignOutConfirm open={signOutOpen} onOpenChange={setSignOutOpen} />
    </div>
  );
}

/** Up-to-two-letter initials from a display name (falls back to "?"). */
function initialsOf(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return initials || '?';
}

'use client';

import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/hooks/useAuth';
import { cn } from '@/lib/utils';

/**
 * "Log out" for the screens a new account passes through before the app:
 * the onboarding steps, "Check your email" and the verification link's
 * landing page (Stay, 19 October 2026, 15:09 UTC: "Add the logout so users
 * can logout and test"). Until now those screens had no way out but finishing.
 *
 * The app's own log out (`useAuth().logout`, the menu's "Log out"): push
 * cleanup, the server revoke, the device's confidential chats, then sign-in.
 * Drawn only for a signed-in account; a guest or a signed-out visitor has
 * nothing to leave.
 */
export function LogOutButton({ className }: { className?: string }) {
  const { isAuthenticated, isGuest, logout, isLoggingOut } = useAuth();
  if (!isAuthenticated || isGuest) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => logout()}
      disabled={isLoggingOut}
      className={cn('text-muted-foreground hover:text-foreground', className)}
    >
      {isLoggingOut ? (
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut aria-hidden className="h-4 w-4" />
      )}
      {isLoggingOut ? 'Logging out...' : 'Log out'}
    </Button>
  );
}

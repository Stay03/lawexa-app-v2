'use client';

import { useState, useCallback } from 'react';
import { Bell } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { NotificationDropdown } from './NotificationDropdown';
import { useUnreadCount } from '@/lib/hooks/useNotifications';
import { useAuthStore } from '@/lib/stores/authStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

/******************************************************************************
                                Component
******************************************************************************/

/**
 * Default component. Notification bell icon with unread badge.
 * Shows popover on desktop, sheet on mobile.
 */
function NotificationBell() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const { data: unreadData } = useUnreadCount();

  const unreadCount = unreadData?.data?.unread_count ?? 0;

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  // Don't render for guests or unauthenticated users
  if (!isAuthenticated || isGuest) {
    return null;
  }

  const bellButton = (
    <Button variant="ghost" size="icon" className="relative h-8 w-8">
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span
          className={cn(
            'absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none',
            unreadCount > 9 ? 'h-4.5 w-5 px-0.5' : 'h-4 w-4'
          )}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
      <span className="sr-only">Notifications</span>
    </Button>
  );

  // Mobile: use Sheet (slide-up drawer)
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {bellButton}
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Notifications</SheetTitle>
          </SheetHeader>
          <NotificationDropdown onClose={handleClose} />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: use Popover
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {bellButton}
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0"
        align="end"
        sideOffset={8}
      >
        <NotificationDropdown onClose={handleClose} />
      </PopoverContent>
    </Popover>
  );
}

/******************************************************************************
                                Export default
******************************************************************************/

export default NotificationBell;
export { NotificationBell };

'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

interface RouteTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Fades route content in on navigation so page-to-page changes feel smooth
 * instead of popping. Keyed by pathname so the entrance animation replays on
 * each route change (but not on in-page state updates), and so a full-height
 * child like the channel reader gets a clean remount per route.
 */
export function RouteTransition({ children, className }: RouteTransitionProps) {
  const pathname = usePathname();
  return (
    <div
      key={pathname}
      className={cn('animate-in fade-in-0 duration-300 ease-out', className)}
    >
      {children}
    </div>
  );
}

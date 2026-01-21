'use client';

import React, { useRef, useEffect, forwardRef } from 'react';
import { cn } from '@/lib/utils';

// ChatContainerRoot - scrollable container with auto-scroll behavior
export interface ChatContainerRootProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  autoScroll?: boolean;
}

export const ChatContainerRoot = forwardRef<
  HTMLDivElement,
  ChatContainerRootProps
>(({ children, className, autoScroll = true, ...props }, ref) => {
  const innerRef = useRef<HTMLDivElement>(null);
  const containerRef = (ref as React.RefObject<HTMLDivElement>) || innerRef;

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [children, autoScroll, containerRef]);

  return (
    <div
      ref={containerRef}
      className={cn('flex-1 overflow-y-auto', className)}
      {...props}
    >
      {children}
    </div>
  );
});
ChatContainerRoot.displayName = 'ChatContainerRoot';

// ChatContainerContent - content wrapper with max-width and padding
export interface ChatContainerContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ChatContainerContent = forwardRef<
  HTMLDivElement,
  ChatContainerContentProps
>(({ children, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('mx-auto max-w-2xl space-y-6 px-4 py-6', className)}
      {...props}
    >
      {children}
    </div>
  );
});
ChatContainerContent.displayName = 'ChatContainerContent';

'use client';

import React, { useRef, useEffect, forwardRef, useState, useCallback, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';

// ChatContainerRoot - scrollable container with scroll state tracking
export interface ChatContainerRootProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  onScrollStateChange?: (needsScroll: boolean) => void;
}

export const ChatContainerRoot = forwardRef<
  HTMLDivElement,
  ChatContainerRootProps
>(({ children, className, onScrollStateChange, ...props }, ref) => {
  const localRef = useRef<HTMLDivElement>(null);
  const prevChildrenRef = useRef(children);
  const isNearBottomRef = useRef(true);
  const needsScrollRef = useRef(false);

  // Expose localRef as the forwarded ref so parent can also use it
  useImperativeHandle(ref, () => localRef.current as HTMLDivElement);

  // Check if user is near the bottom of the scroll container
  const checkScrollPosition = useCallback(() => {
    const scrollEl = localRef.current;
    if (scrollEl) {
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      isNearBottomRef.current = distanceFromBottom <= 100;

      // Hide button when user scrolls to bottom
      if (isNearBottomRef.current && needsScrollRef.current) {
        needsScrollRef.current = false;
        onScrollStateChange?.(false);
      }
    }
  }, [onScrollStateChange]);

  // Listen to scroll events on the container + check position on mount
  useEffect(() => {
    const scrollEl = localRef.current;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', checkScrollPosition);
      checkScrollPosition();
      return () => scrollEl.removeEventListener('scroll', checkScrollPosition);
    }
  }, [checkScrollPosition]);

  // Detect new content - only show button if user is not at bottom
  useEffect(() => {
    if (children !== prevChildrenRef.current) {
      prevChildrenRef.current = children;

      // Re-check scroll position before deciding
      const scrollEl = localRef.current;
      if (scrollEl) {
        const { scrollTop, scrollHeight, clientHeight } = scrollEl;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        isNearBottomRef.current = distanceFromBottom <= 100;
      }

      if (!isNearBottomRef.current && !needsScrollRef.current) {
        needsScrollRef.current = true;
        onScrollStateChange?.(true);
      }
    }
  }, [children, onScrollStateChange]);

  return (
    <div
      ref={localRef}
      className={cn('h-full', className)}
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

'use client';

import React, { useRef, useEffect, forwardRef, useState, useCallback, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';
import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ChatContainerRoot - scrollable container with scroll-to-bottom button
export interface ChatContainerRootProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ChatContainerRoot = forwardRef<
  HTMLDivElement,
  ChatContainerRootProps
>(({ children, className, ...props }, ref) => {
  const localRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const prevChildrenRef = useRef(children);
  const isNearBottomRef = useRef(true);

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
      if (isNearBottomRef.current) {
        setShowScrollButton(false);
        setHasNewMessage(false);
      }
    }
  }, []);

  // Listen to scroll events on the container + check position on mount
  useEffect(() => {
    const scrollEl = localRef.current;
    if (scrollEl) {
      scrollEl.addEventListener('scroll', checkScrollPosition);
      checkScrollPosition(); // Set initial position immediately
      return () => scrollEl.removeEventListener('scroll', checkScrollPosition);
    }
  }, [checkScrollPosition]);

  // Detect new content - only show button if user is not at bottom
  useEffect(() => {
    if (children !== prevChildrenRef.current) {
      prevChildrenRef.current = children;

      // Re-check scroll position before deciding (ref may be stale)
      const scrollEl = localRef.current;
      if (scrollEl) {
        const { scrollTop, scrollHeight, clientHeight } = scrollEl;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        isNearBottomRef.current = distanceFromBottom <= 100;
      }

      if (!isNearBottomRef.current) {
        setHasNewMessage(true);
        setShowScrollButton(true);
      }
    }
  }, [children]);

  // Scroll to bottom handler
  const scrollToBottom = useCallback(() => {
    const scrollEl = localRef.current;
    if (scrollEl) {
      scrollEl.scrollTo({
        top: scrollEl.scrollHeight,
        behavior: 'smooth',
      });
      setShowScrollButton(false);
      setHasNewMessage(false);
    }
  }, []);

  return (
    <>
      <div
        ref={localRef}
        className={cn('h-full', className)}
        {...props}
      >
        {children}
      </div>

      {/* Scroll to bottom button - only shows when new content and not at bottom */}
      {showScrollButton && hasNewMessage && (
        <Button
          size="icon"
          variant="secondary"
          className="fixed bottom-20 left-1/2 z-40 h-10 w-10 -translate-x-1/2 rounded-full shadow-lg"
          onClick={scrollToBottom}
        >
          <ArrowDown className="h-5 w-5" />
        </Button>
      )}
    </>
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

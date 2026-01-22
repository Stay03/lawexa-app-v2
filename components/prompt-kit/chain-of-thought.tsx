'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// ChainOfThought - Root container for all steps
export interface ChainOfThoughtProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ChainOfThought = forwardRef<HTMLDivElement, ChainOfThoughtProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ChainOfThought.displayName = 'ChainOfThought';

// ChainOfThoughtStep - Individual step with vertical line connection
export interface ChainOfThoughtStepProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  isLast?: boolean;
  status?: 'loading' | 'success' | 'error';
}

export const ChainOfThoughtStep = forwardRef<HTMLDivElement, ChainOfThoughtStepProps>(
  ({ children, className, isLast = false, status = 'loading', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('relative pl-8 pb-1', className)}
        {...props}
      >
        {/* Circle marker */}
        <div className="absolute left-0 top-0.5 z-10">
          <div
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full',
              status === 'loading' && 'bg-muted text-muted-foreground',
              status === 'success' && 'bg-green-500/10 text-green-600',
              status === 'error' && 'bg-destructive/10 text-destructive'
            )}
          >
            {status === 'loading' && (
              <div className="h-2 w-2 animate-pulse rounded-full bg-current" />
            )}
            {status === 'success' && (
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {status === 'error' && (
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
        </div>

        {/* Vertical line - only if NOT last step */}
        {!isLast && (
          <div
            className="absolute bottom-0 left-[9px] top-6 w-px bg-border"
            aria-hidden="true"
          />
        )}

        {/* Content */}
        <div className="min-h-[24px]">{children}</div>
      </div>
    );
  }
);
ChainOfThoughtStep.displayName = 'ChainOfThoughtStep';

// ChainOfThoughtTrigger - Header row with icon and text
export interface ChainOfThoughtTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightContent?: React.ReactNode;
}

export const ChainOfThoughtTrigger = forwardRef<HTMLDivElement, ChainOfThoughtTriggerProps>(
  ({ children, className, leftIcon, rightContent, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center gap-2', className)}
        {...props}
      >
        {leftIcon && <span className="shrink-0">{leftIcon}</span>}
        <span className="flex-1 text-sm">{children}</span>
        {rightContent && (
          <span className="text-muted-foreground text-xs">{rightContent}</span>
        )}
      </div>
    );
  }
);
ChainOfThoughtTrigger.displayName = 'ChainOfThoughtTrigger';

// ChainOfThoughtContent - Optional details container
export interface ChainOfThoughtContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ChainOfThoughtContent = forwardRef<HTMLDivElement, ChainOfThoughtContentProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('mt-1 space-y-1', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ChainOfThoughtContent.displayName = 'ChainOfThoughtContent';

// ChainOfThoughtItem - Individual detail item
export interface ChainOfThoughtItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const ChainOfThoughtItem = forwardRef<HTMLDivElement, ChainOfThoughtItemProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('text-muted-foreground text-sm', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ChainOfThoughtItem.displayName = 'ChainOfThoughtItem';

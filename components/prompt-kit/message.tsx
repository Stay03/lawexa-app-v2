'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

// Message - wrapper with role-based alignment
export interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  role?: 'user' | 'assistant';
}

export const Message = forwardRef<HTMLDivElement, MessageProps>(
  ({ children, className, role = 'assistant', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col gap-2',
          role === 'assistant' ? 'items-start' : 'items-end',
          // Assistant messages should take full width for proper markdown rendering
          role === 'assistant' && 'w-full',
          className
        )}
        data-role={role}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Message.displayName = 'Message';

// MessageContent - text content with optional markdown rendering
export interface MessageContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  markdown?: boolean;
}

export const MessageContent = forwardRef<HTMLDivElement, MessageContentProps>(
  ({ children, className, markdown = false, ...props }, ref) => {
    if (markdown && typeof children === 'string') {
      return (
        <div
          ref={ref}
          className={cn(
            'prose prose-sm dark:prose-invert max-w-none',
            // Custom overrides for app theme
            '[&_a]:text-primary [&_a.case-mention]:no-underline',
            '[&_code]:bg-muted [&_pre]:bg-muted',
            className
          )}
          {...props}
        >
          <ReactMarkdown remarkPlugins={[remarkBreaks, remarkGfm]}>
            {children}
          </ReactMarkdown>
        </div>
      );
    }

    return (
      <div ref={ref} className={cn(className)} {...props}>
        {children}
      </div>
    );
  }
);
MessageContent.displayName = 'MessageContent';

// MessageActions - container for action buttons
export interface MessageActionsProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const MessageActions = forwardRef<HTMLDivElement, MessageActionsProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
MessageActions.displayName = 'MessageActions';

// MessageAction - individual action button
export interface MessageActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const MessageAction = forwardRef<HTMLButtonElement, MessageActionProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5 transition-colors',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
MessageAction.displayName = 'MessageAction';

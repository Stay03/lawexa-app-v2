'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { LawyerCardList } from '@/components/chat/lawyer-card';
import { QuizCardList } from '@/components/chat/quiz-card';
import {
  parseContent,
  hasSpecialContent,
} from '@/lib/utils/parse-content-xml';

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
      // Check if content has special XML tags (lawyers or quizzes)
      if (hasSpecialContent(children)) {
        const parsed = parseContent(children);

        return (
          <div ref={ref} className={cn('space-y-3', className)} {...props}>
            {parsed.segments.map((segment, index) => {
              if (segment.type === 'lawyers') {
                return (
                  <LawyerCardList
                    key={`lawyers-${index}`}
                    lawyers={segment.lawyers}
                  />
                );
              }

              if (segment.type === 'quizzes') {
                return (
                  <QuizCardList
                    key={`quizzes-${index}`}
                    quizzes={segment.quizzes}
                  />
                );
              }

              return (
                <div
                  key={`text-${index}`}
                  className={cn(
                    'prose prose-sm dark:prose-invert max-w-none overflow-x-hidden break-words',
                    '[&_a]:text-primary [&_a.case-mention]:no-underline',
                    '[&_code]:bg-muted [&_pre]:bg-muted [&_pre]:overflow-x-auto'
                  )}
                >
                  <ReactMarkdown remarkPlugins={[remarkBreaks, remarkGfm]}>
                    {segment.content}
                  </ReactMarkdown>
                </div>
              );
            })}
          </div>
        );
      }

      return (
        <div
          ref={ref}
          className={cn(
            'prose prose-sm dark:prose-invert max-w-none overflow-x-hidden break-words',
            // Custom overrides for app theme
            '[&_a]:text-primary [&_a.case-mention]:no-underline',
            '[&_code]:bg-muted [&_pre]:bg-muted [&_pre]:overflow-x-auto',
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

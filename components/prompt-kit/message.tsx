'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { LawyerCardList } from '@/components/chat/lawyer-card';
import { QuizCardList } from '@/components/chat/quiz-card';
import { DeepResearchPromptCard } from '@/components/chat/deep-research-prompt-card';
import { MultiQuestionPromptCard } from '@/components/chat/multi-question-prompt-card';
import { NextQuestionPromptCard } from '@/components/chat/next-question-prompt-card';
import { MultiQuestionPlanCard } from '@/components/chat/multi-question-plan-card';
import { MultiQuestionProgressCard } from '@/components/chat/multi-question-progress-card';
import { ExecutionPlanCard } from '@/components/chat/execution-plan-card';
import { MultiQuestionCompleteCard } from '@/components/chat/multi-question-complete-card';
import { NoteLinkCard } from '@/components/chat/note-link-card';
import { GeneratingIndicator } from '@/components/chat/generating-indicator';
import {
  parseContent,
  hasSpecialContent,
} from '@/lib/utils/parse-content-xml';

// Shared prose styling for markdown-rendered chat text (assistant messages).
const MARKDOWN_PROSE_CLASS =
  'prose prose-sm dark:prose-invert max-w-none overflow-x-hidden break-words ' +
  '[&_a]:text-primary [&_a.case-mention]:no-underline ' +
  '[&_code]:bg-muted [&_pre]:bg-muted [&_pre]:overflow-x-auto';

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
  /** When true, interactive prompt cards (buttons) inside this message will be disabled */
  isInteracted?: boolean;
  /** When true, an in-progress (unclosed) special block renders as a "generating…" pill. */
  isStreaming?: boolean;
}

export const MessageContent = forwardRef<HTMLDivElement, MessageContentProps>(
  ({ children, className, markdown = false, isInteracted = false, isStreaming = false, ...props }, ref) => {
    if (markdown && typeof children === 'string') {
      // Check if content has special XML tags (lawyers or quizzes)
      if (hasSpecialContent(children)) {
        const parsed = parseContent(children);

        return (
          <div ref={ref} className={cn('w-full min-w-0 space-y-3', className)} {...props}>
            {parsed.segments.map((segment, index) => {
              if (segment.type === 'lawyers') {
                return (
                  <div key={`lawyers-${index}`} className="not-prose">
                    <LawyerCardList lawyers={segment.lawyers} />
                  </div>
                );
              }

              if (segment.type === 'quizzes') {
                return (
                  <div key={`quizzes-${index}`} className="not-prose">
                    <QuizCardList quizzes={segment.quizzes} />
                  </div>
                );
              }

              if (segment.type === 'deep_research_prompt') {
                return (
                  <div key={`deep-research-${index}`} className="not-prose">
                    <DeepResearchPromptCard prompt={segment.prompt} isInteracted={isInteracted} />
                  </div>
                );
              }

              if (segment.type === 'multi_question_prompt') {
                return (
                  <div key={`multi-question-${index}`} className="not-prose">
                    <MultiQuestionPromptCard prompt={segment.prompt} isInteracted={isInteracted} />
                  </div>
                );
              }

              if (segment.type === 'next_question_prompt') {
                return (
                  <div key={`next-question-${index}`} className="not-prose">
                    <NextQuestionPromptCard prompt={segment.prompt} isInteracted={isInteracted} />
                  </div>
                );
              }

              if (segment.type === 'multi_question_plan') {
                return (
                  <div key={`multi-question-plan-${index}`} className="not-prose">
                    <MultiQuestionPlanCard plan={segment.plan} isInteracted={isInteracted} />
                  </div>
                );
              }

              if (segment.type === 'multi_question_progress') {
                return (
                  <div key={`multi-question-progress-${index}`} className="not-prose">
                    <MultiQuestionProgressCard progress={segment.progress} />
                  </div>
                );
              }

              if (segment.type === 'execution_plan') {
                return (
                  <div key={`execution-plan-${index}`} className="not-prose">
                    <ExecutionPlanCard plan={segment.plan} />
                  </div>
                );
              }

              if (segment.type === 'multi_question_complete') {
                return (
                  <div key={`multi-question-complete-${index}`} className="not-prose">
                    <MultiQuestionCompleteCard info={segment.info} />
                  </div>
                );
              }

              if (segment.type === 'note_link') {
                return (
                  <div key={`note-link-${index}`} className="not-prose">
                    <NoteLinkCard note={segment.note} />
                  </div>
                );
              }

              if (segment.type === 'generating') {
                // Live stream: show the lightweight pill in place of the raw
                // partial. Finalized/truncated message: render the raw partial as
                // text so no content is ever lost (a superset of prior behaviour).
                if (isStreaming) {
                  return (
                    <div key={`generating-${index}`} className="not-prose">
                      <GeneratingIndicator element={segment.element} />
                    </div>
                  );
                }
                return (
                  <div key={`generating-${index}`} className={MARKDOWN_PROSE_CLASS}>
                    <ReactMarkdown remarkPlugins={[remarkBreaks, remarkGfm]}>
                      {segment.raw}
                    </ReactMarkdown>
                  </div>
                );
              }

              return (
                <div key={`text-${index}`} className={MARKDOWN_PROSE_CLASS}>
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

'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { parseContent, hasSpecialContent } from '@/lib/utils/parse-content-xml';
import { MarkdownText } from './MarkdownText';
import { LawyerCardList } from '../cards/LawyerCard';
import { QuizCardList } from '../cards/QuizCard';
import { DeepResearchPromptCard } from '../cards/DeepResearchPromptCard';
import { MultiQuestionPromptCard } from '../cards/MultiQuestionPromptCard';
import { NextQuestionPromptCard } from '../cards/NextQuestionPromptCard';
import { MultiQuestionPlanCard } from '../cards/MultiQuestionPlanCard';
import { MultiQuestionProgressCard } from '../cards/MultiQuestionProgressCard';
import { ExecutionPlanCard } from '../cards/ExecutionPlanCard';
import { MultiQuestionCompleteCard } from '../cards/MultiQuestionCompleteCard';
import { NoteLinkCard } from '../cards/NoteLinkCard';
import { GeneratingIndicator } from '../cards/GeneratingIndicator';

/**
 * ChatContent — the assistant message body renderer. Mirrors v1's
 * `MessageContent` special-content path (prompt-kit) but v2-native: it parses the
 * inline-card XML with the shared `parseContent` util (allowed), renders each of
 * the KEEP-list result cards (quiz / lawyers / deep-research / multi-question /
 * execution-plan / next-question / note-link), and streams plain prose through the
 * block-memoized {@link MarkdownText}. When no special block is present it renders
 * markdown directly — the common, hot path.
 *
 * `isStreaming` swaps an unclosed special block for the lightweight "generating…"
 * pill (the real card snaps in once the closing tag arrives); `isInteracted`
 * disables the prompt cards' actions once a later user turn exists.
 */
export const ChatContent = memo(function ChatContent({
  content,
  isStreaming = false,
  isInteracted = false,
  className,
}: {
  content: string;
  isStreaming?: boolean;
  isInteracted?: boolean;
  className?: string;
}) {
  if (!hasSpecialContent(content)) {
    return <MarkdownText content={content} className={className} />;
  }

  const parsed = parseContent(content);

  return (
    <div className={cn('w-full min-w-0 space-y-3', className)}>
      {parsed.segments.map((segment, index) => {
        switch (segment.type) {
          case 'lawyers':
            return (
              <div key={`lawyers-${index}`} className="not-prose">
                <LawyerCardList lawyers={segment.lawyers} />
              </div>
            );
          case 'quizzes':
            return (
              <div key={`quizzes-${index}`} className="not-prose">
                <QuizCardList quizzes={segment.quizzes} />
              </div>
            );
          case 'deep_research_prompt':
            return (
              <div key={`deep-research-${index}`} className="not-prose">
                <DeepResearchPromptCard prompt={segment.prompt} isInteracted={isInteracted} />
              </div>
            );
          case 'multi_question_prompt':
            return (
              <div key={`multi-question-${index}`} className="not-prose">
                <MultiQuestionPromptCard prompt={segment.prompt} isInteracted={isInteracted} />
              </div>
            );
          case 'next_question_prompt':
            return (
              <div key={`next-question-${index}`} className="not-prose">
                <NextQuestionPromptCard prompt={segment.prompt} isInteracted={isInteracted} />
              </div>
            );
          case 'multi_question_plan':
            return (
              <div key={`multi-question-plan-${index}`} className="not-prose">
                <MultiQuestionPlanCard plan={segment.plan} isInteracted={isInteracted} />
              </div>
            );
          case 'multi_question_progress':
            return (
              <div key={`multi-question-progress-${index}`} className="not-prose">
                <MultiQuestionProgressCard progress={segment.progress} />
              </div>
            );
          case 'execution_plan':
            return (
              <div key={`execution-plan-${index}`} className="not-prose">
                <ExecutionPlanCard plan={segment.plan} />
              </div>
            );
          case 'multi_question_complete':
            return (
              <div key={`multi-question-complete-${index}`} className="not-prose">
                <MultiQuestionCompleteCard info={segment.info} />
              </div>
            );
          case 'note_link':
            return (
              <div key={`note-link-${index}`} className="not-prose">
                <NoteLinkCard note={segment.note} />
              </div>
            );
          case 'generating':
            // Live stream → the pill; finalized/truncated → render the raw partial
            // as text so no content is ever lost (v1 parity).
            return isStreaming ? (
              <div key={`generating-${index}`} className="not-prose">
                <GeneratingIndicator element={segment.element} />
              </div>
            ) : (
              <MarkdownText key={`generating-${index}`} content={segment.raw} />
            );
          case 'text':
          default:
            return <MarkdownText key={`text-${index}`} content={segment.content} />;
        }
      })}
    </div>
  );
});

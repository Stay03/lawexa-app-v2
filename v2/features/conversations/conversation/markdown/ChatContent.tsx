'use client';

import { memo, type ReactNode } from 'react';
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
import { DraftCard } from '../draft/DraftCard';
import { mayHoldDraft, splitDrafts } from '../draft/draft-blocks';
import { useSidePanel } from '../side-panel/SidePanelContext';

/**
 * ChatContent — the assistant message body renderer. Mirrors v1's
 * `MessageContent` special-content path (prompt-kit) but v2-native: it parses the
 * inline-card XML with the shared `parseContent` util (allowed), renders each of
 * the KEEP-list result cards (quiz / lawyers / deep-research / multi-question /
 * execution-plan / next-question / note-link), and streams plain prose through the
 * block-memoized {@link MarkdownText}.
 *
 * `isStreaming` swaps an unclosed special block for the lightweight "generating…"
 * pill (the real card snaps in once the closing tag arrives); `isInteracted`
 * disables the prompt cards' actions once a later user turn exists.
 *
 * STABLE SUBTREE (the remount fix). This used to return a bare `<MarkdownText/>` on
 * the common path and a `<div>` wrapper the moment a special tag appeared. React
 * sees a different element TYPE at that position, so the entire rendered answer
 * unmounted and remounted the instant the model emitted its first `<quiz>` — a
 * visible flash, every word-fade replayed at once, and every `content-visibility`
 * measurement in the subtree thrown away. The wrapper is now ALWAYS rendered, and
 * the prose child carries the SAME `text-0` key the first parsed segment would, so
 * the common prose→prose+card transition reconciles in place instead of remounting.
 *
 * DRAFTS (the draft editor, Stay 23 October 2026). A `<draft title="…">` block
 * becomes a card that opens the draft in the chat's side panel; the reply text
 * around it renders as before. The split runs only when the text may hold one
 * (`<d`), and the first part keeps the `text-0` keys, so an answer that starts
 * a draft mid-stream reconciles its opening prose in place.
 *
 * HOT-PATH COST. `parseContent` (14 global regex sweeps plus the unclosed-tag scan)
 * must never run on plain prose, so the fast path is preserved — and guarded further
 * by a single `includes('<')`: `hasSpecialContent` can only match after a `<`, so the
 * cheap native scan is an exact pre-filter for its 11 regex sweeps, and legal prose
 * essentially never contains `<`.
 */
export const ChatContent = memo(function ChatContent({
  content,
  messageId,
  isStreaming = false,
  isDraining = false,
  isInteracted = false,
  className,
}: {
  content: string;
  /** The answer's id, so its drafts know their place in the chat (draft-ordinals.ts). */
  messageId?: string;
  isStreaming?: boolean;
  /**
   * The answer is COMPLETE but its tail is still being revealed by the terminal
   * drain (see `finish` in stream-smoother.ts). Deliberately separate from
   * `isStreaming`: the per-word fade and the "generating" pill must stay on
   * through the drain (text is still arriving on screen, and a half-revealed card
   * tag must not flash its raw XML), while anything gated on "a turn is in
   * flight" must not.
   */
  isDraining?: boolean;
  isInteracted?: boolean;
  className?: string;
}) {
  const panel = useSidePanel();

  // The per-word fade and the "generating" pill DO span the drain: text is still
  // appearing on screen, and a half-revealed card tag must keep its pill rather
  // than flash raw XML for the length of the drain.
  //
  // NO STAND-IN BAR FOR THE NEXT LINE. The `line` style used to render a pulsing
  // placeholder where the next line would land. The owner removed it: the style is
  // a RELEASE RHYTHM (whole lines instead of whole words), and it reads better with
  // nothing standing in for what has not arrived. `useStreamStyle` is therefore no
  // longer read here at all — the style now reaches only the smoother, which is
  // the one place it belongs.
  const revealing = isStreaming || isDraining;

  const parts = content.includes('<') && mayHoldDraft(content) ? splitDrafts(content, revealing) : null;
  if (parts && parts.some((part) => part.kind === 'draft')) {
    const offset = messageId && panel ? panel.draftOffset(messageId) : 0;
    // Each draft part's place among this answer's drafts, counted up front.
    const ordinals = parts.map((_, index) => offset + parts.slice(0, index).filter((part) => part.kind === 'draft').length);
    const body = parts.flatMap<ReactNode>((part, index) => {
      if (part.kind === 'draft') {
        const ordinal = ordinals[index];
        return [
          <div key={`draft-${index}`} className="not-prose">
            <DraftCard draft={part.draft} ordinal={ordinal} live={revealing} />
          </div>,
        ];
      }
      // The first part keeps the plain path's keys (see DRAFTS in the docblock).
      return renderBody(part.text, revealing, isInteracted, index === 0 ? '' : `p${index}-`);
    });
    return <div className={cn('w-full min-w-0 space-y-3', className)}>{body}</div>;
  }

  const body = renderBody(content, revealing, isInteracted, '');
  return <div className={cn('w-full min-w-0 space-y-3', className)}>{body}</div>;
});

/**
 * The answer's text, as markdown and the inline cards. `keyPrefix` keeps the
 * keys of a text part after a draft apart from the first part's.
 */
function renderBody(content: string, revealing: boolean, isInteracted: boolean, keyPrefix: string): ReactNode[] {
  // Exact pre-filter (see docblock): every `hasSpecialContent` pattern begins with
  // `<`, so no `<` ⇒ no special content, at one native scan instead of eleven.
  const special = content.includes('<') && hasSpecialContent(content);
  const segments = special ? parseContent(content).segments : null;

  // BOTH branches produce an ARRAY at the same slot on purpose. React reconciles a
  // single element and an array at one position as different things (the array
  // becomes an implicit-key Fragment fiber), so returning a bare element on the
  // fast path and a mapped array on the special path would remount the whole answer
  // the moment a card appeared — the very flash this component's docblock is about.
  return segments === null
      ? [<MarkdownText key={`${keyPrefix}text-0`} content={content} animate={revealing} />]
      : segments.map((segment, index) => {
          switch (segment.type) {
            case 'lawyers':
              return (
                <div key={`${keyPrefix}lawyers-${index}`} className="not-prose">
                  <LawyerCardList lawyers={segment.lawyers} />
                </div>
              );
            case 'quizzes':
              return (
                <div key={`${keyPrefix}quizzes-${index}`} className="not-prose">
                  <QuizCardList quizzes={segment.quizzes} />
                </div>
              );
            case 'deep_research_prompt':
              return (
                <div key={`${keyPrefix}deep-research-${index}`} className="not-prose">
                  <DeepResearchPromptCard prompt={segment.prompt} isInteracted={isInteracted} />
                </div>
              );
            case 'multi_question_prompt':
              return (
                <div key={`${keyPrefix}multi-question-${index}`} className="not-prose">
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
                <div key={`${keyPrefix}multi-question-plan-${index}`} className="not-prose">
                  <MultiQuestionPlanCard plan={segment.plan} isInteracted={isInteracted} />
                </div>
              );
            case 'multi_question_progress':
              return (
                <div key={`${keyPrefix}multi-question-progress-${index}`} className="not-prose">
                  <MultiQuestionProgressCard progress={segment.progress} />
                </div>
              );
            case 'execution_plan':
              return (
                <div key={`${keyPrefix}execution-plan-${index}`} className="not-prose">
                  <ExecutionPlanCard plan={segment.plan} />
                </div>
              );
            case 'multi_question_complete':
              return (
                <div key={`${keyPrefix}multi-question-complete-${index}`} className="not-prose">
                  <MultiQuestionCompleteCard info={segment.info} />
                </div>
              );
            case 'note_link':
              return (
                <div key={`${keyPrefix}note-link-${index}`} className="not-prose">
                  <NoteLinkCard note={segment.note} />
                </div>
              );
            case 'generating':
              // Live stream → the pill; finalized/truncated → render the raw partial
              // as text so no content is ever lost (v1 parity).
              return revealing ? (
                <div key={`${keyPrefix}generating-${index}`} className="not-prose">
                  <GeneratingIndicator element={segment.element} />
                </div>
              ) : (
                <MarkdownText key={`${keyPrefix}generating-${index}`} content={segment.raw} />
              );
            case 'text':
            default:
              return (
                <MarkdownText
                  key={`${keyPrefix}text-${index}`}
                  content={segment.content}
                  animate={revealing}
                />
              );
          }
        });
}

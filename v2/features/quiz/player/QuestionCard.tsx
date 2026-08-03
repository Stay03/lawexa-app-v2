'use client';

import { useEffect, useId, useMemo, useRef } from 'react';

import { cn } from '@/lib/utils';
import type { QuizQuestion } from '@/types/quiz';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { OptionButton } from './OptionButton';

/**
 * QuestionCard — the played question and its answers, and the owner of the
 * keyboard game.
 *
 * ── KEYS 1–4, SCOPED TO FOCUS (WCAG 2.1.4) ──────────────────────────────────
 * Single-character shortcuts are a Level-A failure unless they can be turned
 * off, remapped, OR are "only active when the component has focus" (SC 2.1.4,
 * Character Key Shortcuts). This handler is bound to the question GROUP, not to
 * `window`, so the digits are live exactly while focus is inside this card and
 * inert everywhere else — the third option, taken without a settings screen.
 * That also means a digit typed into any other control on the page can never
 * submit an answer.
 *
 * ── FOCUS FOLLOWS THE QUESTION, BUT NEVER STEALS IT ─────────────────────────
 * Auto-advance replaces the whole card, so a keyboard player who had focus on
 * an option would be dropped to `<body>` and lose the game after one answer.
 * On every sequence CHANGE, focus moves to the group — whose accessible name is
 * the question text, so a screen reader hears the new question rather than a
 * bare option — and the digits stay live for the next answer.
 *
 * It deliberately does NOT focus on FIRST mount: arriving at the player should
 * not yank focus out of the header or scroll the page, and a reader who never
 * touches the keyboard should never be moved by it. The previous sequence is
 * tracked in a ref (no state, so no `setState` in an effect — React Compiler
 * lint), which is also why this component must NOT be remounted per question:
 * the ANIMATION is keyed on an inner wrapper instead, so the instance — and
 * therefore the "did the question change?" memory — survives.
 *
 * AND THE MOVE IS VISIBLE. A programmatically focused container with no focus
 * ring means a keyboard player has no idea where they are between questions —
 * an invisible focus indicator is a WCAG 2.4.7 failure, and it fails precisely
 * the flow the number keys exist for. The group therefore carries the house
 * focus ring on `:focus-visible`, which is exactly the right predicate here:
 * the browser sets it when the move followed keyboard input (pressing `2` to
 * advance) and withholds it after a tap, so touch players never see a ring
 * they did not ask for.
 *
 * ── THE PENDING BEAT ────────────────────────────────────────────────────────
 * `aria-busy` on the option list is the correct ARIA mechanism for "this region
 * is updating" and keeps the surface at ONE live region (the score chip's — see
 * `ScoreChip`), instead of two announcements racing on every answer.
 */
export function QuestionCard({
  question,
  sequence,
  selectedId,
  pending,
  onSelect,
}: {
  question: QuizQuestion;
  /** The served position — the animation key and the focus trigger. */
  sequence: number;
  /** The option tapped for THIS question, or null. */
  selectedId: number | null;
  /** A submit is in flight (locks the group, spins the chosen option). */
  pending: boolean;
  onSelect: (optionId: number) => void;
}) {
  const headingId = useId();
  const groupRef = useRef<HTMLElement>(null);
  const lastSequence = useRef<number | null>(null);

  // The backend serves `position`; never trust array order for a numbered list.
  const options = useMemo(
    () => [...question.options].sort((a, b) => a.position - b.position),
    [question.options],
  );

  useEffect(() => {
    const previous = lastSequence.current;
    lastSequence.current = sequence;
    // Only on a CHANGE — never the first mount. See the docblock.
    if (previous !== null && previous !== sequence) {
      groupRef.current?.focus();
    }
  }, [sequence]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (pending) return;
    // Modified keys belong to the browser and to screen readers, never to us.
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.length !== 1) return;

    const index = Number(event.key) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= options.length) return;

    event.preventDefault();
    onSelect(options[index].id);
  };

  return (
    <section
      ref={groupRef}
      // Programmatically focusable so the auto-advance can land here; never in
      // the tab sequence, so a mouse user tabs straight to the first option.
      tabIndex={-1}
      role="group"
      aria-labelledby={headingId}
      onKeyDown={handleKeyDown}
      // `outline-none` kills the UA default; FOCUS_RING puts a real, visible
      // one back on `:focus-visible`. `rounded-xl` + the offset keep the ring
      // clear of the option cards inside it.
      className={cn('rounded-xl outline-none', FOCUS_RING)}
    >
      {/* Keyed on the sequence so each question slides in — on an INNER wrapper,
          because remounting the card would erase the focus memory above. */}
      <div
        key={sequence}
        className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-300"
      >
        <h1
          id={headingId}
          className="text-balance text-lg font-semibold leading-relaxed text-foreground sm:text-xl"
        >
          {question.question_text}
        </h1>

        <div
          aria-busy={pending || undefined}
          className="mt-6 flex flex-col gap-2.5"
        >
          {options.map((option, index) => (
            <OptionButton
              key={option.id}
              label={option.option_text}
              index={index}
              selected={selectedId === option.id}
              pending={pending && selectedId === option.id}
              disabled={pending}
              onSelect={() => onSelect(option.id)}
            />
          ))}
        </div>

        {/* Reinforcement, not the affordance — the numbered square on every
            option is the affordance and it is always visible.
            Gated on POINTER CAPABILITY, not width: a large tablet is `md` and
            up but has no keys, so a width-only rule promises a shortcut that
            does not exist there. `hover: hover` + `pointer: fine` is the real
            question ("is there a precise pointer, i.e. a desktop-class input
            setup?"), and it correctly excludes touch at every size. */}
        <p className="mt-4 hidden text-xs text-muted-foreground/80 [@media(hover:hover)_and_(pointer:fine)]:block">
          Tap an answer, or press{' '}
          <kbd className="rounded border border-border bg-secondary px-1 py-0.5 font-sans text-[11px] tabular-nums">
            1
          </kbd>
          –
          <kbd className="rounded border border-border bg-secondary px-1 py-0.5 font-sans text-[11px] tabular-nums">
            {options.length}
          </kbd>
          . It submits straight away — answers are revealed when you end the
          session.
        </p>
      </div>
    </section>
  );
}

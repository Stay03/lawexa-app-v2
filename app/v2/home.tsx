'use client';

import { useState } from 'react';
import {
  ArrowUp,
  BookText,
  GraduationCap,
  NotebookPen,
  Paperclip,
  Scale,
  Sparkles,
  Globe,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/prompt-input';

/** The four suggested prompts from the round-3 mockup. */
const SUGGESTED_PROMPTS = [
  'Explain the ratio in Madukolu v Nkemdilim',
  'Consent under the Land Use Act, state by state',
  'Draft a memo on tenant eviction in Lagos',
  'Quiz me on the Evidence Act 2011',
] as const;

/** Quiet library shortcuts beneath the composer. */
const SHORTCUTS: { label: string; icon: LucideIcon }[] = [
  { label: 'Cases', icon: Scale },
  { label: 'Statutes', icon: BookText },
  { label: 'Notes', icon: NotebookPen },
  { label: 'Quiz', icon: GraduationCap },
];

/**
 * V2Home — the real v2 home surface (UI-only this wave).
 *
 * Mirrors v1's home structure — greeting, the shimmer PromptInput composer with
 * its chip row, suggested prompts, quiet shortcuts — rebuilt on the shared
 * primitive layer. The shimmer is the ORIGINAL `.gold-shimmer` (the default
 * `PromptInput` variant wraps its `gold-shimmer p-[1px]` exactly as v1's
 * composer does). Submit is a no-op and the chips are non-functional visual
 * affordances; interactions land in phase 3.
 *
 * Per the locked design decision, body typography is v1's system sans —
 * Comfortaa is reserved for the wordmark (in the shell chrome), not here.
 */
export function V2Home({ name }: { name?: string }) {
  const [input, setInput] = useState('');

  // Submit is intentionally inert this wave.
  const handleSubmit = () => {};

  const setPrompt = (prompt: string) => setInput(prompt);

  return (
    <div
      data-v2-marker="V2-HOME"
      className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-4 py-10"
    >
      {/* Greeting — no time-of-day wiring this wave; name shown when a server
          session is present. */}
      <div className="mb-6 text-center">
        <h1 className="text-[26px] font-medium text-foreground md:text-[36px]">
          Good evening{name ? <>, <span className="text-primary">{name}</span></> : null}.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          What are we researching?
        </p>
      </div>

      {/* Shimmer composer — the real prompt-input primitive. */}
      <div className="w-full">
        <PromptInput
          value={input}
          onValueChange={setInput}
          onSubmit={handleSubmit}
        >
          <PromptInputTextarea
            placeholder="Ask anything about Nigerian law"
            className="text-foreground"
          />

          <PromptInputActions className="flex items-center justify-between gap-2 px-3 pb-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-muted-foreground"
                aria-label="Attach a file"
              >
                <Paperclip className="size-4" />
              </Button>
              <ComposerChip icon={Globe} label="Nigeria" />
              <ComposerChip icon={Sparkles} label="Lawexa Expert" iconClassName="text-primary" />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <PromptInputAction tooltip="Send message">
                <Button
                  type="button"
                  size="icon"
                  className="size-8 rounded-full bg-primary hover:bg-primary/90"
                  onClick={handleSubmit}
                  disabled={!input.trim()}
                  aria-label="Send message"
                >
                  <ArrowUp className="size-5" />
                </Button>
              </PromptInputAction>
            </div>
          </PromptInputActions>
        </PromptInput>

        {/* Suggested prompts — vertical on mobile, wrapped row on desktop. */}
        <div className="mt-3 flex flex-col gap-2 md:flex-row md:flex-wrap md:justify-center">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setPrompt(prompt)}
              className="rounded-2xl border border-border px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary md:rounded-full md:py-2"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Quiet library shortcuts. */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {SHORTCUTS.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary"
            >
              <Icon className="size-4 shrink-0 text-primary" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A non-functional composer chip (attach-row affordance). */
function ComposerChip({
  icon: Icon,
  label,
  iconClassName,
}: {
  icon: LucideIcon;
  label: string;
  iconClassName?: string;
}) {
  return (
    <button
      type="button"
      className="flex h-7 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs text-muted-foreground transition-colors hover:bg-secondary"
    >
      <Icon className={cn('size-3.5 shrink-0', iconClassName)} />
      {label}
    </button>
  );
}

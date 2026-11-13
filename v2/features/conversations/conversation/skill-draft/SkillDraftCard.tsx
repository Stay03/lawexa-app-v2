'use client';

import { useId, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Loader2, ScrollText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { skillDraftErrorSentence, skillDraftKindLine, skillDraftStatusLine } from '@/lib/utils/skill-draft';
import { skillDraftsApi } from '@/lib/api/skill-drafts';
import type { SkillDraft, SkillDraftCard } from '@/types/skill-draft';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useV2ChatContext } from '../chat-context';
import { InstructionsDiff, InstructionsText } from './InstructionsDiff';

/**
 * SkillDraftCardView — a skill Lawexa drafted in this chat (the skills tool,
 * thread 2b436b4f; Arthur's 1A 2A 3A 4B), under the answer that drafted it.
 *
 * Closed, it reads from the answer's own card: the skill's title, its one-line
 * description, and "New skill" or "Changes {name}". Opening it asks for the
 * whole draft (GET /api/skill-drafts/{uuid}) to show the steps; for a change,
 * the steps are marked against the live skill's, line by line.
 *
 * While the draft waits for the person ("proposed"), Save sends it to an admin
 * and Not now sets it aside; the server's answer moves every row showing it at
 * once (`settleSkillDraft`). After that the card says where the draft stands,
 * and the server keeps it current as an admin publishes or rejects it: the
 * card follows on the next read of the chat. Nobody is messaged (4B).
 *
 * Only the person who asked gets the draft; anyone else's request is a 404,
 * which the card says plainly. A 422 shows the server's own sentence.
 */
export function SkillDraftCardView({ card }: { card: SkillDraftCard }) {
  const chat = useV2ChatContext();
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  const draft = useQuery({
    queryKey: ['skill-draft', card.draft],
    queryFn: () => skillDraftsApi.get(card.draft),
    enabled: open,
    retry: (count, error) => extractApiError(error).status >= 500 && count < 2,
    staleTime: 30_000,
  });

  const settle = useMutation({
    mutationFn: (action: 'save' | 'dismiss') =>
      action === 'save' ? skillDraftsApi.save(card.draft) : skillDraftsApi.dismiss(card.draft),
    onSuccess: (response) => chat?.settleSkillDraft(card.draft, response.data.status),
  });

  const statusLine = skillDraftStatusLine(card.status);
  const waiting = card.status === 'proposed';
  const settleError = settle.error ? skillDraftErrorSentence(extractApiError(settle.error)) : null;

  return (
    <section
      aria-label={`Skill draft: ${card.displayName}`}
      className="mt-3 overflow-hidden rounded-2xl border border-border bg-card motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
    >
      <div className="flex items-start gap-3 p-3.5">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
          <ScrollText className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug font-semibold text-foreground">{card.displayName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{skillDraftKindLine(card)}</p>
          {card.description && <p className="mt-1.5 text-[13px] leading-snug text-foreground/80">{card.description}</p>}
        </div>
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((shown) => !shown)}
        className={cn(
          'v2-interactive flex w-full items-center gap-1.5 border-t border-border/70 px-3.5 py-2 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground',
          FOCUS_RING,
        )}
      >
        <ChevronDown aria-hidden className={cn('size-4 transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
        {/* The steps open as the new version; "Show changes" inside marks them (Stay, 20:40Z). */}
        {open ? 'Hide the steps' : 'Show the steps'}
      </button>

      {open && (
        <div id={bodyId} className="border-t border-border/70 px-3.5 py-3">
          {draft.isPending ? (
            <div aria-hidden className="space-y-2">
              <Skeleton className="h-3.5 w-11/12 rounded" />
              <Skeleton className="h-3.5 w-4/5 rounded" />
              <Skeleton className="h-3.5 w-2/3 rounded" />
            </div>
          ) : draft.isError ? (
            <p role="alert" className="text-[13px] text-destructive">
              {skillDraftErrorSentence(extractApiError(draft.error))}
            </p>
          ) : (
            <DraftSteps draft={draft.data.data} />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-3.5 py-2.5">
        {waiting ? (
          <>
            <Button
              type="button"
              size="sm"
              disabled={settle.isPending || chat?.canSend === false}
              onClick={() => settle.mutate('save')}
            >
              {settle.isPending && settle.variables === 'save' ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={settle.isPending || chat?.canSend === false}
              onClick={() => settle.mutate('dismiss')}
            >
              Not now
            </Button>
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">Save sends it to an admin to approve.</p>
          </>
        ) : (
          <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            {card.status === 'pending' || card.status === 'published' ? (
              <Check aria-hidden className="size-3.5 text-primary" />
            ) : null}
            {statusLine}
          </p>
        )}
      </div>
      {settleError && (
        <p role="alert" className="px-3.5 pb-2.5 text-[13px] text-destructive">
          {settleError}
        </p>
      )}
    </section>
  );
}

/**
 * The steps, as formatted text. For a change, the new version alone by
 * default; "Show changes" marks it against the live skill (Stay, 13 November
 * 2026, 2b436b4f: "I dont know if the diff is necessary but it should be
 * optional"). Off on each open; nothing is remembered.
 */
function DraftSteps({ draft }: { draft: SkillDraft }) {
  const [showChanges, setShowChanges] = useState(false);
  const switchId = useId();
  if (draft.kind === 'change' && draft.live) {
    return (
      <div className="space-y-2">
        {draft.live.changed_since_draft && (
          <p className="text-xs text-muted-foreground">
            The live skill has changed since this draft was written (now version {draft.live.version}).
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <Label htmlFor={switchId} className="text-xs font-normal text-muted-foreground">
            Show changes
          </Label>
          <Switch id={switchId} checked={showChanges} onCheckedChange={setShowChanges} />
        </div>
        {showChanges ? (
          <InstructionsDiff before={draft.live.instructions} after={draft.instructions} />
        ) : (
          <InstructionsText text={draft.instructions} />
        )}
      </div>
    );
  }
  return <InstructionsText text={draft.instructions} />;
}

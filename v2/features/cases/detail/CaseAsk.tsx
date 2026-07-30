'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Loader2, MessageSquare } from 'lucide-react';

import { cn, stripPastedTags } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PromptInput,
  PromptInputAction,
  PromptInputTextarea,
} from '@/components/ui/prompt-input';
import type { JurisdictionChoice } from '@/types/jurisdiction';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { formatRelativeTime } from '@/v2/shell/designs/modules/meta';
import { JurisdictionField } from '@/v2/shell/designs/composer/JurisdictionField';
import { startConversation } from '@/v2/features/conversations/start-conversation';
import { casesQueries } from '../queries';

/**
 * CaseAskDock — the case page's chat entry, rebuilt to the CONVERSATION PILL'S
 * exact scale (owner, July 29: "I want the one in the message conversation
 * page, that exact style — this one is too big, noisy and messy").
 *
 * ── AT REST: the pill, nothing else ─────────────────────────────────────────
 * The same anatomy as `ConversationComposer`: `max-w-xs sm:max-w-md`, one
 * `min-h-9` textarea row, a `size-8` round send button, the downward-biased
 * shadow so no shade band climbs into the judgment. No furniture is visible —
 * the reading stays clean to the pill's edge.
 *
 * ── ON FOCUS: the hub opens above it ────────────────────────────────────────
 * v1 answered a click here by sliding out a right-hand sheet with its own chat
 * engine inside. The owner wants "something like that but better and cleaner":
 * focusing the pill expands a SOLID panel directly above it — the reader's
 * recent chats about this case (the v1 feature, kept), three case-shaped
 * openers, and the jurisdiction chip. It collapses on Escape or a click
 * outside. The panel is a persistent-node grid collapse (the conversation
 * composer's own pattern), so open and close both animate and the chats query
 * mounts exactly once.
 *
 * ── ONE CHAT SYSTEM ─────────────────────────────────────────────────────────
 * Submit goes through the same `startConversation` as everywhere else, tagged
 * `references: [{ type: 'case' }]`, and lands on the REAL conversation screen.
 * Deliberately absent from this surface: attachments, confidential/redacted,
 * workflow — those are home-composer concerns; a reader who needs them starts
 * from the home. That absence is what keeps the pill a pill.
 */

const PROMPTS = [
  'Explain this case in plain language',
  'What is the ratio decidendi?',
  'How has this case been treated since?',
] as const;

export function CaseAskDock({
  slug,
  signedIn,
  viewerId,
  onOpenChat,
}: {
  slug: string;
  signedIn: boolean;
  viewerId: number | null;
  /** Open a conversation in the case page's side chat (`?chat={id}`). */
  onOpenChat: (conversationId: string) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const dockRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [jurisdiction, setJurisdiction] = useState<JurisdictionChoice>({ mode: 'auto' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collapse on a pointer-down outside the dock, and on Escape. Clicks inside
  // PORTALED overlays (the jurisdiction popover renders into a Radix popper
  // wrapper on <body>) are part of the dock's interaction and must not close
  // it — the wrapper attribute is the discriminator. Listeners are attached
  // only while open; setState inside a DOM event handler is compiler-clean.
  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (dockRef.current?.contains(target)) return;
      if (target.closest('[data-radix-popper-content-wrapper]')) return;
      setExpanded(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [expanded]);

  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  const fillPrompt = (prompt: string) => {
    setDraft(prompt);
    // Hand focus back to the field so the reader edits or sends immediately.
    dockRef.current?.querySelector('textarea')?.focus();
  };

  const submit = async () => {
    const message = draft.trim();
    if (!message || isSubmitting) return;
    if (!signedIn) {
      router.push('/login');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await startConversation(
        {
          message,
          attachments: [],
          jurisdiction,
          references: [{ type: 'case', id: slug }],
        },
        { queryClient },
      );
      setDraft('');
      // Refresh "your chats about this case" so the new thread is in the hub
      // the next time it opens (the queries doc: explicit invalidation here).
      void queryClient.invalidateQueries({
        queryKey: [...casesQueries.all, 'conversations', slug],
      });
      // Open the SIDE CHAT rather than leaving the judgment (owner: "check
      // while still on the page"). The embedded controller consumes the same
      // `conv_init` handoff `startConversation` just wrote, so the stream
      // attaches inside the panel. Opening unmounts this dock — the panel
      // carries the composer from here.
      onOpenChat(result.conversationId);
      // Keep `isSubmitting` true through the swap — no double-submit window.
    } catch (err) {
      setError(extractApiError(err).message);
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={dockRef} className="sticky bottom-0 z-10 -mx-4 mt-auto px-4 pb-3 pt-10">
      {/* Dissolve the judgment scrolling behind the pill — dense at the pill,
          gone by the top, so text fades out instead of running at full ink
          straight into the composer (owner, July 30). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-background from-35% via-background/80 to-transparent"
      />

      <div className="mx-auto w-full max-w-xs sm:max-w-md">
        {/* ── The hub: a persistent-node collapse above the pill. ── */}
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
            expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div
              aria-hidden={!expanded}
              inert={!expanded}
              className={cn(
                'mb-2 flex flex-col gap-3 rounded-2xl border border-border bg-popover p-3 shadow-[0_6px_16px_-8px_rgba(0,0,0,0.28)] transition-opacity duration-200 ease-out motion-reduce:transition-none',
                expanded ? 'opacity-100' : 'opacity-0',
              )}
            >
              {signedIn ? (
                <RecentCaseChats
                  slug={slug}
                  viewerId={viewerId}
                  onOpenChat={onOpenChat}
                />
              ) : null}

              <div className="flex flex-col gap-1.5">
                <p className="px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  Start with
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {PROMPTS.map((prompt) => (
                    <li key={prompt}>
                      <button
                        type="button"
                        onClick={() => fillPrompt(prompt)}
                        className={cn(
                          'v2-interactive inline-flex min-h-8 items-center rounded-full border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                          FOCUS_RING,
                        )}
                      >
                        {prompt}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {signedIn ? (
                <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                  <JurisdictionField
                    signedIn
                    value={jurisdiction}
                    onChange={setJurisdiction}
                    disabled={isSubmitting}
                    stop={stop}
                  />
                  <span className="text-[11px] text-muted-foreground/60">
                    Opens a new chat
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Error — quiet, above the pill, cleared on the next keystroke. */}
        {error ? (
          <div
            role="alert"
            className="mb-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            {error}
          </div>
        ) : null}

        {/* ── The pill — the conversation composer's exact scale. ── */}
        <PromptInput
          value={draft}
          onValueChange={(next) => {
            setDraft(next);
            if (error) setError(null);
          }}
          onSubmit={submit}
          disabled={isSubmitting}
          maxHeight={150}
          className="shadow-[0_6px_16px_-8px_rgba(0,0,0,0.28)]"
        >
          <div className="flex items-end gap-1.5">
            <PromptInputTextarea
              placeholder="Ask about this case"
              className="text-foreground placeholder:text-muted-foreground min-h-9 flex-1 px-2 py-2"
              onFocus={() => setExpanded(true)}
            />
            <PromptInputAction tooltip="Send message">
              <Button
                type="button"
                size="icon"
                className="v2-interactive bg-primary hover:bg-primary/90 size-8 shrink-0 rounded-full"
                onClick={submit}
                disabled={!draft.trim() || isSubmitting}
                aria-label="Send message"
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </Button>
            </PromptInputAction>
          </div>
        </PromptInput>
      </div>
    </div>
  );
}

/**
 * The reader's recent threads about this case, inside the hub. Owner-scoped on
 * the server and viewer-partitioned in the cache; renders nothing when there
 * are none (the hub's openers already say what to do) and fails quiet — the
 * threads are still reachable from /conversations. Rows open the SIDE CHAT
 * (buttons, not links): resuming a thread about the case keeps the case.
 */
function RecentCaseChats({
  slug,
  viewerId,
  onOpenChat,
}: {
  slug: string;
  viewerId: number | null;
  onOpenChat: (conversationId: string) => void;
}) {
  const query = useQuery(casesQueries.conversations(slug, { viewerId }));
  const [now] = useState(() => Date.now());
  const rows = (query.data?.data ?? []).slice(0, 3);

  if (query.isPending) {
    return (
      <div aria-hidden className="flex flex-col gap-1.5">
        <Skeleton className="h-3 w-36 rounded" />
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    );
  }
  if (query.isError || rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <p className="px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
        Pick up where you left off
      </p>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onOpenChat(row.id)}
              className={cn(
                'v2-interactive flex w-full min-h-9 items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-secondary/60',
                FOCUS_RING,
              )}
            >
              <MessageSquare
                aria-hidden
                className="size-3.5 shrink-0 text-muted-foreground/70"
              />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {stripPastedTags(row.title) || 'Untitled conversation'}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/60">
                {formatRelativeTime(row.updated_at, now)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

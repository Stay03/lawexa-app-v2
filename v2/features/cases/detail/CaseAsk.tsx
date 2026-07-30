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
 * CaseAskDock — the case page's chat entry, at the CONVERSATION PILL'S exact
 * scale (owner, July 29), plus the shared pieces the side chat's NEW-CHAT
 * view reuses (`useStartCaseChat`, `RecentCaseChats`, `CASE_PROMPTS`).
 *
 * ── TWO ENTRY FLOWS, BY POINTER REAL ESTATE (owner, July 30) ────────────────
 * DESKTOP (≥xl): focusing the pill expands the HUB above it — recent chats,
 * openers, jurisdiction — and submitting opens the side chat with the answer
 * streaming in. There is room for a popover next to a reading column.
 * MOBILE: there is not. Tapping the pill skips the popup entirely and opens
 * the chat sheet in its new-chat view ("it should just show the Chat · this
 * case slide-up") — same content, one surface, no intermediate hop.
 *
 * ── ONE CHAT SYSTEM ─────────────────────────────────────────────────────────
 * Every submit goes through the same `startConversation` as everywhere else,
 * tagged `references: [{ type: 'case' }]`, and lands in the REAL conversation
 * screen (embedded in the panel, or full at /c/{id}). Deliberately absent
 * here: attachments, confidential/redacted, workflow — home-composer
 * concerns; their absence is what keeps the pill a pill.
 */

export const CASE_PROMPTS = [
  'Explain this case in plain language',
  'What is the ratio decidendi?',
  'How has this case been treated since?',
] as const;

/** The xl media query — the same boundary the panel uses for column-vs-sheet. */
const SIDE_PANEL_QUERY = '(min-width: 80rem)';

/**
 * The one way a case chat starts: draft + jurisdiction in, conversation out,
 * with the "your chats about this case" query refreshed. Shared by the dock's
 * pill (desktop) and the panel's new-chat view (mobile + in-panel back).
 */
export function useStartCaseChat(
  slug: string,
  signedIn: boolean,
  onOpened: (conversationId: string) => void,
) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (draft: string, jurisdiction: JurisdictionChoice) => {
    const message = draft.trim();
    if (!message || isSubmitting) return false;
    if (!signedIn) {
      router.push('/login');
      return false;
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
      // Refresh "your chats about this case" so the new thread is listed the
      // next time the hub or the panel's list opens.
      void queryClient.invalidateQueries({
        queryKey: [...casesQueries.all, 'conversations', slug],
      });
      // The embedded controller consumes the `conv_init` handoff
      // `startConversation` just wrote, so the stream attaches in the panel.
      onOpened(result.conversationId);
      // `isSubmitting` stays true through the swap — no double-submit window.
      return true;
    } catch (err) {
      setError(extractApiError(err).message);
      setIsSubmitting(false);
      return false;
    }
  };

  return { submit, isSubmitting, error, clearError: () => setError(null) };
}

export function CaseAskDock({
  slug,
  signedIn,
  viewerId,
  onOpenChat,
}: {
  slug: string;
  signedIn: boolean;
  viewerId: number | null;
  /** Open the side chat: a conversation id, or 'new' for the new-chat view. */
  onOpenChat: (chatId: string) => void;
}) {
  const dockRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [jurisdiction, setJurisdiction] = useState<JurisdictionChoice>({ mode: 'auto' });
  const start = useStartCaseChat(slug, signedIn, onOpenChat);

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

  const submit = () => void start.submit(draft, jurisdiction).then((ok) => {
    if (ok) setDraft('');
  });

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
        {/* ── The hub: a persistent-node collapse above the pill (≥xl only —
            below that the pill opens the sheet instead). ── */}
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
                  {CASE_PROMPTS.map((prompt) => (
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
                    disabled={start.isSubmitting}
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
        {start.error ? (
          <div
            role="alert"
            className="mb-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            {start.error}
          </div>
        ) : null}

        {/* ── The pill — the conversation composer's exact scale. ── */}
        <PromptInput
          value={draft}
          onValueChange={(next) => {
            setDraft(next);
            if (start.error) start.clearError();
          }}
          onSubmit={submit}
          disabled={start.isSubmitting}
          maxHeight={150}
          className="shadow-[0_6px_16px_-8px_rgba(0,0,0,0.28)]"
        >
          <div className="flex items-end gap-1.5">
            <PromptInputTextarea
              placeholder="Ask about this case"
              className="text-foreground placeholder:text-muted-foreground min-h-9 flex-1 px-2 py-2"
              onFocus={(event) => {
                // No room for a popover next to the reading below xl — the tap
                // goes straight to the chat sheet's new-chat view instead
                // (owner: "it should just show the Chat · this case slide-up").
                if (!window.matchMedia(SIDE_PANEL_QUERY).matches) {
                  event.currentTarget.blur();
                  onOpenChat('new');
                  return;
                }
                setExpanded(true);
              }}
            />
            <PromptInputAction tooltip="Send message">
              <Button
                type="button"
                size="icon"
                className="v2-interactive bg-primary hover:bg-primary/90 size-8 shrink-0 rounded-full"
                onClick={submit}
                disabled={!draft.trim() || start.isSubmitting}
                aria-label="Send message"
              >
                {start.isSubmitting ? (
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
 * The reader's recent threads about this case. Owner-scoped on the server and
 * viewer-partitioned in the cache; renders nothing when there are none and
 * fails quiet — the threads are still reachable from /conversations. Rows
 * open the SIDE CHAT (buttons, not links): resuming a thread about the case
 * keeps the case. Shared by the dock hub and the panel's new-chat view.
 */
export function RecentCaseChats({
  slug,
  viewerId,
  onOpenChat,
  limit = 3,
}: {
  slug: string;
  viewerId: number | null;
  onOpenChat: (conversationId: string) => void;
  limit?: number;
}) {
  const query = useQuery(casesQueries.conversations(slug, { viewerId }));
  const [now] = useState(() => Date.now());
  const rows = (query.data?.data ?? []).slice(0, limit);

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

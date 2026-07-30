'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Loader2, MessageSquare, PanelRight, X } from 'lucide-react';

import { cn, stripPastedTags } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
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
 * CaseAsk — the case page's composer dock, plus the pieces every chat
 * presentation shares (`CaseComposer`, `CaseChatNewContent`,
 * `useStartCaseChat`, `RecentCaseChats`, `CASE_PROMPTS`).
 *
 * ── ONE COMPOSER (owner, July 31: "only one, the same one that will load on
 * the page, but when I click on it it gives the popup — still same one") ──
 * The dock used to be a BUTTON dressed in the composer's clothes, and the
 * look-alike hand-off on close read as the chat popping back open. Now the
 * dock holds the REAL composer — `CaseComposer`, the one component every
 * new-chat view renders — and on desktop the panel GROWS OUT OF IT in place:
 * the composer element never unmounts, never loses focus, never changes
 * identity; recents, prompts and jurisdiction materialise above it inside
 * one card. On mobile, focusing it raises the sheet, whose new-chat view is
 * the same component with the same shared draft — one composer, one draft,
 * at every width.
 *
 * The gradient dissolve stays PERMANENTLY mounted in the dock, so the bottom
 * strip never flashes in and out with the chat.
 */

export const CASE_PROMPTS = [
  'Explain this case in plain language',
  'What is the ratio decidendi?',
  'How has this case been treated since?',
] as const;

/**
 * The one way a case chat starts: draft + jurisdiction in, conversation out,
 * with the "your chats about this case" query refreshed. ONE instance lives
 * in `CaseBody` and is shared by every presentation, so a double submit is
 * impossible across surfaces.
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
      // next time the new-chat view opens.
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

/** Everything the shared composer needs, lifted to `CaseBody` so the draft
 * survives presentation swaps (dock ⇄ sheet ⇄ docked column). */
export interface CaseComposerState {
  draft: string;
  onDraftChange: (next: string) => void;
  jurisdiction: JurisdictionChoice;
  onJurisdictionChange: (next: JurisdictionChoice) => void;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: () => void;
}

/**
 * THE composer — the only one the case page has. The dock renders it in
 * place; the sheet and the docked column render the same component with the
 * same shared state. `PromptInput` itself wears the gold-shimmer pill ring,
 * which is exactly what the old costume button was imitating.
 */
export function CaseComposer({
  composer,
  autoFocus = false,
  onEngage,
}: {
  composer: CaseComposerState;
  autoFocus?: boolean;
  /** Fired on focus, click, or typing — the dock uses it to open the chat. */
  onEngage?: () => void;
}) {
  return (
    <PromptInput
      value={composer.draft}
      onValueChange={(next) => {
        composer.onDraftChange(next);
        onEngage?.();
      }}
      onSubmit={composer.onSubmit}
      disabled={composer.isSubmitting}
      maxHeight={150}
      onClick={onEngage}
    >
      <div className="flex items-end gap-1.5">
        <PromptInputTextarea
          autoFocus={autoFocus}
          placeholder="Ask about this case"
          onFocus={onEngage}
          className="text-foreground placeholder:text-muted-foreground min-h-9 flex-1 px-2 py-2 text-base"
        />
        <PromptInputAction tooltip="Send message">
          <Button
            type="button"
            size="icon"
            className="v2-interactive bg-primary hover:bg-primary/90 size-8 shrink-0 rounded-full"
            onClick={composer.onSubmit}
            disabled={!composer.draft.trim() || composer.isSubmitting}
            aria-label="Send message"
          >
            {composer.isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </PromptInputAction>
      </div>
    </PromptInput>
  );
}

/**
 * The new-chat view's CONTENT — recents, openers, the error strip and the
 * jurisdiction row — without the composer, so each surface can place the one
 * composer where its geometry needs it (the dock keeps it in place on the
 * page; the sheet pins it to its own bottom).
 */
export function CaseChatNewContent({
  slug,
  signedIn,
  viewerId,
  onOpenChat,
  composer,
}: {
  slug: string;
  signedIn: boolean;
  viewerId: number | null;
  onOpenChat: (conversationId: string) => void;
  composer: CaseComposerState;
}) {
  return (
    <div className="flex flex-col gap-5">
      {signedIn ? (
        <RecentCaseChats
          slug={slug}
          viewerId={viewerId}
          onOpenChat={onOpenChat}
          limit={5}
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
                onClick={() => composer.onDraftChange(prompt)}
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
    </div>
  );
}

/** The error strip + jurisdiction row that sit directly above the composer —
 * shared so every surface shows submission state the same way. */
export function CaseComposerMeta({
  composer,
  signedIn,
}: {
  composer: CaseComposerState;
  signedIn: boolean;
}) {
  return (
    <>
      {composer.error ? (
        <div
          role="alert"
          className="mb-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          {composer.error}
        </div>
      ) : null}
      {signedIn ? (
        <div className="mb-2 flex items-center gap-2">
          <JurisdictionField
            signedIn
            value={composer.jurisdiction}
            onChange={composer.onJurisdictionChange}
            disabled={composer.isSubmitting}
            stop={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}

const BAR_BUTTON =
  'v2-interactive flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground';

/**
 * CaseAskDock — the composer's home on the page, and (on desktop) the chat's
 * floating new-chat surface: the panel grows out of the composer IN PLACE.
 *
 *  - CLOSED: the bare composer pill over the gradient dissolve.
 *  - OPEN (`panelMounted`, ≥xl floating): the container gains the elevated
 *    card chrome and the panel (bar · recents · prompts · jurisdiction)
 *    expands ABOVE the composer via a grid-rows transition — a TRANSITION,
 *    not an animation, so the collapsed state is committed style and can
 *    never flash (the fill-mode lesson, structurally avoided).
 *  - The composer element itself is NEVER remounted by open/close: the panel
 *    slot renders `null` when closed, keeping the composer's tree position —
 *    and therefore its focus and caret — stable.
 */
export function CaseAskDock({
  slug,
  signedIn,
  viewerId,
  composer,
  panelMounted,
  panelOpen,
  onEngage,
  onClose,
  onDock,
  onOpenChat,
}: {
  slug: string;
  signedIn: boolean;
  viewerId: number | null;
  composer: CaseComposerState;
  /** The floating new-chat panel is in the tree (open or animating out). */
  panelMounted: boolean;
  /** The panel is expanded (false while collapsing toward unmount). */
  panelOpen: boolean;
  /** Open the chat for this width (sheet below xl, panel at xl). */
  onEngage: () => void;
  onClose: () => void;
  onDock: () => void;
  onOpenChat: (conversationId: string) => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-auto px-4 pb-3 pt-10 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      {/* The gradient dissolve — PERMANENT, whether the pill rests alone or
          the panel is up, so the bottom strip never flashes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-background from-35% via-background/80 to-transparent"
      />

      <div
        role={panelMounted ? 'complementary' : undefined}
        aria-label={panelMounted ? 'Chat about this case' : undefined}
        className={cn(
          'mx-auto w-full max-w-xs rounded-3xl sm:max-w-md',
          'transition-[background-color,box-shadow,border-color,max-width] duration-300 motion-reduce:transition-none',
          panelMounted &&
            'max-w-md border border-border bg-popover p-3 shadow-[0_28px_70px_-28px_rgba(0,0,0,0.75)] sm:max-w-md',
        )}
      >
        {/* The panel slot — `null` keeps the composer's tree position stable
            so opening never remounts it. Grid-rows 0fr⇄1fr is the both-ways
            grow/collapse; the inner row clips. */}
        {panelMounted ? (
          <div
            data-open={panelOpen}
            className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-[open=true]:grid-rows-[1fr] motion-reduce:transition-none"
          >
            <div className="min-h-0 overflow-hidden">
              <div className="flex max-h-[min(24rem,calc(100dvh-16rem))] flex-col">
                {/* ── The bar: label · dock · close. ── */}
                <div className="flex min-h-10 shrink-0 items-center gap-1 border-b border-border/60 px-0.5">
                  <span aria-hidden className="size-8" />
                  <p className="flex-1 truncate px-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                    Chat · this case
                  </p>
                  <button
                    type="button"
                    onClick={onDock}
                    aria-label="Dock the chat to the side"
                    title="Dock to the side"
                    className={cn(BAR_BUTTON, FOCUS_RING)}
                  >
                    <PanelRight aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close the chat"
                    className={cn(BAR_BUTTON, FOCUS_RING)}
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-3">
                  <CaseChatNewContent
                    slug={slug}
                    signedIn={signedIn}
                    viewerId={viewerId}
                    onOpenChat={onOpenChat}
                    composer={composer}
                  />
                </div>
                <div className="shrink-0 pt-1">
                  <CaseComposerMeta composer={composer} signedIn={signedIn} />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <CaseComposer composer={composer} onEngage={onEngage} />
      </div>
    </div>
  );
}

/**
 * The reader's recent threads about this case. Owner-scoped on the server and
 * viewer-partitioned in the cache; renders nothing when there are none and
 * fails quiet — the threads are still reachable from /conversations. Rows
 * open in the chat surface (buttons, not links): resuming a thread about the
 * case keeps the case.
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

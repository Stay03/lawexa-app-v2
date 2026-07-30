'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUp, Loader2, Maximize2, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  PromptInput,
  PromptInputAction,
  PromptInputTextarea,
} from '@/components/ui/prompt-input';
import type { JurisdictionChoice } from '@/types/jurisdiction';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { JurisdictionField } from '@/v2/shell/designs/composer/JurisdictionField';
import { ConversationScreen } from '@/v2/features/conversations/conversation/ConversationScreen';
import { CASE_PROMPTS, RecentCaseChats, useStartCaseChat } from './CaseAsk';

/**
 * CaseChatSurface — the case page's side chat: the REAL conversation screen
 * (engine, privacy resolvers, streaming, composer — the whole thing) docked
 * BESIDE the judgment, so reading and asking are one activity.
 *
 * ── TWO VIEWS, ONE URL PARAM ────────────────────────────────────────────────
 * `?chat={conversationId}` shows that conversation; `?chat=new` shows the
 * NEW-CHAT view — the reader's threads about this case, the openers, the
 * jurisdiction chip, and a composer. The bar's back arrow (owner, July 30:
 * "there is no back so I can see the list of conversations") returns from a
 * conversation to that view. In-panel navigation REPLACES the URL, so the
 * whole panel is ONE history entry: the browser's Back always closes it and
 * returns to the reading, never walks the panel's internal hops.
 *
 * ── ONE MOUNT ACROSS BREAKPOINTS ────────────────────────────────────────────
 * Desktop (≥xl — below that the sidebar + panel would squeeze the judgment to
 * ~350px) is an in-flow side column; narrower is a full overlay under the
 * h-14 header, its bottom riding `--keyboard-inset`. ONE responsive element,
 * never two: two would mean two live controllers on one conversation.
 *
 * ── PRESENCE, WITHOUT A HORIZONTAL SCROLLBAR ────────────────────────────────
 * The desktop panel animates its WIDTH (0 ⇄ 26rem, keyframes in
 * case-document.css) behind `overflow-x-clip`, so nothing ever extends past
 * the viewport edge — the first cut slid a translated panel in from outside
 * and flashed a horizontal scrollbar (owner). Width animation also moves the
 * reading column CONTINUOUSLY as the flex layout re-centres each frame,
 * instead of snapping. `overflow-x-clip`, not `overflow-hidden`: clip is not
 * a scroll container, so the inner `sticky` keeps working against the shell
 * scroller. Mobile keeps the slide-up sheet. Exit mirrors entry (200ms held
 * before unmount); the render-phase adopt of a new id is the sanctioned
 * adjust-during-render reset.
 */
export function CaseChatSurface({
  chatId,
  slug,
  signedIn,
  viewerId,
  onClose,
  onSwitchChat,
}: {
  chatId: string | null;
  slug: string;
  signedIn: boolean;
  viewerId: number | null;
  onClose: () => void;
  /** In-panel navigation: REPLACES `?chat=` (one history entry per panel). */
  onSwitchChat: (chatId: string) => void;
}) {
  const [rendered, setRendered] = useState(chatId);
  if (chatId !== null && chatId !== rendered) setRendered(chatId);
  const closing = chatId === null && rendered !== null;

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => setRendered(null), 200);
    return () => window.clearTimeout(timer);
  }, [closing]);

  if (rendered === null) return null;

  const isNew = rendered === 'new';

  return (
    <aside
      aria-label="Chat about this case"
      data-state={closing ? 'closed' : 'open'}
      className={cn(
        // Mobile: a full overlay under the shell header, riding the keyboard
        // inset. Desktop: the in-flow right column beside the judgment.
        'fixed inset-x-0 top-14 z-40 bg-background',
        'xl:static xl:inset-auto xl:z-auto xl:w-[26rem] xl:shrink-0 xl:overflow-x-clip xl:border-l xl:border-border/60',
        // Mobile enter/exit: the slide-up sheet, mirrored out.
        'max-xl:motion-safe:animate-in max-xl:motion-safe:fade-in max-xl:motion-safe:slide-in-from-bottom-8 max-xl:motion-safe:duration-300',
        'data-[state=closed]:max-xl:motion-safe:animate-out data-[state=closed]:max-xl:motion-safe:fade-out data-[state=closed]:max-xl:motion-safe:slide-out-to-bottom-8 data-[state=closed]:max-xl:motion-safe:duration-200',
        // Desktop enter/exit: the clipped width reveal (no translate, no
        // scrollbar), eased like a drawer.
        'xl:motion-safe:animate-[v2-case-chat-open_280ms_cubic-bezier(0.32,0.72,0,1)]',
        'data-[state=closed]:xl:motion-safe:animate-[v2-case-chat-close_200ms_ease-in_forwards]',
      )}
      style={{ bottom: 'var(--keyboard-inset, 0px)' }}
    >
      <div className="h-full xl:sticky xl:top-0 xl:h-[calc(100dvh-3.5rem)] xl:w-[26rem]">
        <div className="flex h-full min-h-0 flex-col">
          {/* ── The panel bar: back · label · expand · close. ── */}
          <div className="flex min-h-12 shrink-0 items-center gap-1 border-b border-border/60 px-2">
            {isNew ? (
              <span aria-hidden className="size-8" />
            ) : (
              <button
                type="button"
                onClick={() => onSwitchChat('new')}
                aria-label="Back to your chats about this case"
                className={cn(
                  'v2-interactive flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                  FOCUS_RING,
                )}
              >
                <ArrowLeft aria-hidden className="size-4" />
              </button>
            )}
            <p className="flex-1 truncate px-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
              Chat · this case
            </p>
            {!isNew ? (
              <Link
                href={`/c/${rendered}`}
                aria-label="Open this chat in full"
                title="Open in full"
                className={cn(
                  'v2-interactive flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                  FOCUS_RING,
                )}
              >
                <Maximize2 aria-hidden className="size-4" />
              </Link>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close the chat"
              className={cn(
                'v2-interactive flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                FOCUS_RING,
              )}
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>

          {/* Keyed by view so list ⇄ conversation swaps ease in rather than
              snapping. */}
          <div
            key={isNew ? 'new' : rendered}
            className="min-h-0 flex-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            {isNew ? (
              <CaseChatNew
                slug={slug}
                signedIn={signedIn}
                viewerId={viewerId}
                onSwitchChat={onSwitchChat}
              />
            ) : (
              <ConversationScreen
                conversationId={rendered}
                embed={{ onDeleted: onClose }}
              />
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

/**
 * The panel's NEW-CHAT view — the dock hub's content as a full surface: your
 * threads about this case, the openers, jurisdiction, and a composer. On
 * mobile this IS the entry (tapping the pill lands here); on desktop it is
 * the back arrow's destination.
 */
function CaseChatNew({
  slug,
  signedIn,
  viewerId,
  onSwitchChat,
}: {
  slug: string;
  signedIn: boolean;
  viewerId: number | null;
  onSwitchChat: (chatId: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [jurisdiction, setJurisdiction] = useState<JurisdictionChoice>({ mode: 'auto' });
  const start = useStartCaseChat(slug, signedIn, onSwitchChat);

  const submit = () => void start.submit(draft, jurisdiction).then((ok) => {
    if (ok) setDraft('');
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="flex flex-col gap-5">
          {signedIn ? (
            <RecentCaseChats
              slug={slug}
              viewerId={viewerId}
              onOpenChat={onSwitchChat}
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
                    onClick={() => setDraft(prompt)}
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
      </div>

      {/* ── The composer, pinned to the sheet's bottom. ── */}
      <div className="shrink-0 px-4 pb-3 pt-1">
        {start.error ? (
          <div
            role="alert"
            className="mb-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            {start.error}
          </div>
        ) : null}

        {signedIn ? (
          <div className="mb-2 flex items-center justify-between gap-2">
            <JurisdictionField
              signedIn
              value={jurisdiction}
              onChange={setJurisdiction}
              disabled={start.isSubmitting}
              stop={(event) => event.stopPropagation()}
            />
            <span className="text-[11px] text-muted-foreground/60">
              Opens a new chat
            </span>
          </div>
        ) : null}

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
              autoFocus
              placeholder="Ask about this case"
              className="text-foreground placeholder:text-muted-foreground min-h-9 flex-1 px-2 py-2"
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

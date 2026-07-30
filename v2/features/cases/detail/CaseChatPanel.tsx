'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUp,
  Loader2,
  Maximize2,
  PanelRight,
  PanelRightClose,
  X,
} from 'lucide-react';

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
 * The case page's chat, in its three presentations — one shared body
 * (`CaseChatBody`), one mounted at a time (two would mean two live
 * controllers on one conversation):
 *
 *   SHEET     below xl. A bottom sheet at ~65% of the viewport over a scrim —
 *             the judgment stays visible, dimmed, behind it (owner, July 30:
 *             "just like 60% and some of the page show"), and tapping the
 *             scrim closes. Rides `--keyboard-inset`.
 *   FLOATING  ≥xl, the default. The chat lives IN THE CARD above where the
 *             pill sits (owner: "chat and all that inside that popup above
 *             the textarea") — the reading keeps its full width. The bar's
 *             panel icon docks it.
 *   DOCKED    ≥xl after the reader chooses the sidebar. The in-flow 26rem
 *             column with the clipped width reveal; the bar's icon floats it
 *             back. The choice persists (localStorage) so the chat reopens
 *             the way this reader likes it.
 *
 * Every presentation is an ELEVATED LAYER, visibly apart from the page:
 * `bg-popover` (a step lighter than the page in dark mode), a border, and a
 * directional shadow — the demarcation the owner asked for.
 *
 * URL semantics are the host's (`CaseScreen`): `?chat={id}` / `?chat=new`,
 * pushed once so Back closes, in-panel hops replacing.
 */

interface CaseChatCommonProps {
  chatId: string;
  closing: boolean;
  slug: string;
  signedIn: boolean;
  viewerId: number | null;
  onClose: () => void;
  onSwitchChat: (chatId: string) => void;
}

/* ── Sheet (below xl) ────────────────────────────────────────────────────── */

export function CaseChatSheet(props: CaseChatCommonProps) {
  const state = props.closing ? 'closed' : 'open';
  return (
    <>
      {/* The scrim — the page stays visible behind the sheet, dimmed. A tap
          on it closes, the standard sheet contract. */}
      <div
        aria-hidden
        data-state={state}
        onClick={props.onClose}
        className={cn(
          'fixed inset-0 z-30 bg-black/50',
          'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300',
          'data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:fade-out data-[state=closed]:motion-safe:duration-200',
        )}
      />
      <aside
        aria-label="Chat about this case"
        data-state={state}
        className={cn(
          'fixed inset-x-0 z-40 flex h-[65dvh] min-h-80 flex-col overflow-hidden rounded-t-2xl border-t border-border/60 bg-popover shadow-[0_-24px_60px_-24px_rgba(0,0,0,0.65)]',
          'motion-safe:animate-in motion-safe:slide-in-from-bottom-full motion-safe:duration-300',
          'data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:slide-out-to-bottom-full data-[state=closed]:motion-safe:duration-200',
        )}
        style={{ bottom: 'var(--keyboard-inset, 0px)' }}
      >
        <CaseChatBody {...props} mode="sheet" />
      </aside>
    </>
  );
}

/* ── Floating card (≥xl, the default) ────────────────────────────────────── */

export function CaseChatFloating({
  onDock,
  ...props
}: CaseChatCommonProps & { onDock: () => void }) {
  return (
    <div
      data-state={props.closing ? 'closed' : 'open'}
      className={cn(
        // The dock pill's slot: bottom of the reading column, floating over
        // the text.
        'sticky bottom-3 z-20 mx-auto mt-auto w-full max-w-[26rem]',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300',
        'data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:fade-out data-[state=closed]:motion-safe:slide-out-to-bottom-4 data-[state=closed]:motion-safe:duration-200',
      )}
    >
      <aside
        aria-label="Chat about this case"
        className="flex h-[min(34rem,calc(100dvh-8rem))] flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-[0_28px_70px_-28px_rgba(0,0,0,0.75)]"
      >
        <CaseChatBody {...props} mode="floating" onDock={onDock} />
      </aside>
    </div>
  );
}

/* ── Docked column (≥xl, by choice) ──────────────────────────────────────── */

export function CaseChatDocked({
  onFloat,
  ...props
}: CaseChatCommonProps & { onFloat: () => void }) {
  return (
    <aside
      aria-label="Chat about this case"
      data-state={props.closing ? 'closed' : 'open'}
      className={cn(
        'w-[26rem] shrink-0 overflow-x-clip border-l border-border/60 bg-popover shadow-[-24px_0_50px_-30px_rgba(0,0,0,0.55)]',
        // The clipped width reveal — no translate past the viewport edge, so
        // no horizontal scrollbar; the reading column re-centres continuously.
        'motion-safe:animate-[v2-case-chat-open_280ms_cubic-bezier(0.32,0.72,0,1)]',
        'data-[state=closed]:motion-safe:animate-[v2-case-chat-close_200ms_ease-in_forwards]',
      )}
    >
      <div className="sticky top-0 flex h-[calc(100dvh-3.5rem)] w-[26rem] flex-col">
        <CaseChatBody {...props} mode="docked" onFloat={onFloat} />
      </div>
    </aside>
  );
}

/* ── The shared body: bar + views ────────────────────────────────────────── */

const BAR_BUTTON =
  'v2-interactive flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground';

function CaseChatBody({
  chatId,
  slug,
  signedIn,
  viewerId,
  onClose,
  onSwitchChat,
  mode,
  onDock,
  onFloat,
}: CaseChatCommonProps & {
  mode: 'sheet' | 'floating' | 'docked';
  onDock?: () => void;
  onFloat?: () => void;
}) {
  const isNew = chatId === 'new';

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── The bar: back · label · dock-toggle · expand · close. ── */}
      <div className="flex min-h-12 shrink-0 items-center gap-1 border-b border-border/60 px-2">
        {isNew ? (
          <span aria-hidden className="size-8" />
        ) : (
          <button
            type="button"
            onClick={() => onSwitchChat('new')}
            aria-label="Back to your chats about this case"
            className={cn(BAR_BUTTON, FOCUS_RING)}
          >
            <ArrowLeft aria-hidden className="size-4" />
          </button>
        )}
        <p className="flex-1 truncate px-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
          Chat · this case
        </p>
        {mode === 'floating' && onDock ? (
          <button
            type="button"
            onClick={onDock}
            aria-label="Dock the chat to the side"
            title="Dock to the side"
            className={cn(BAR_BUTTON, FOCUS_RING)}
          >
            <PanelRight aria-hidden className="size-4" />
          </button>
        ) : null}
        {mode === 'docked' && onFloat ? (
          <button
            type="button"
            onClick={onFloat}
            aria-label="Float the chat over the page"
            title="Float over the page"
            className={cn(BAR_BUTTON, FOCUS_RING)}
          >
            <PanelRightClose aria-hidden className="size-4" />
          </button>
        ) : null}
        {!isNew ? (
          <Link
            href={`/c/${chatId}`}
            aria-label="Open this chat in full"
            title="Open in full"
            className={cn(BAR_BUTTON, FOCUS_RING)}
          >
            <Maximize2 aria-hidden className="size-4" />
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the chat"
          className={cn(BAR_BUTTON, FOCUS_RING)}
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      {/* Keyed by view so list ⇄ conversation swaps ease in rather than
          snapping. */}
      <div
        key={isNew ? 'new' : chatId}
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
          <ConversationScreen conversationId={chatId} embed={{ onDeleted: onClose }} />
        )}
      </div>
    </div>
  );
}

/**
 * The NEW-CHAT view — the dock hub's content as a full surface: your threads
 * about this case, the openers, jurisdiction, and a composer. On mobile this
 * IS the entry (tapping the pill lands here); on desktop it is the back
 * arrow's destination.
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

      {/* ── The composer, pinned to the surface's bottom. ── */}
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

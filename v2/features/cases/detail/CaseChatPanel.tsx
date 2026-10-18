'use client';

import { useRef } from 'react';
import { PanelRightClose } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import type { ConversationComposerHandle } from '@/v2/features/conversations/conversation/ConversationComposer';
import {
  CaseChatBar,
  CaseChatComposerDock,
  CaseChatMiddle,
  type CaseChatStart,
} from './CaseChatCore';
import { CHAT_SUBJECT_NOUN, type ChatSubject } from './chat-subject';
import './case-chat-panel.css';

/**
 * The case chat's docked presentation. It renders the SAME one screen
 * (`CaseChatCore`: bar · middle · the one composer) and only owns its frame:
 *
 *   DOCKED    ≥xl after the reader chooses the sidebar: the SIDE PEEK — an
 *             in-flow rail holding a rounded inset panel that stands clear of
 *             the header, the screen edge, and the bottom (no seam, near-no
 *             shadow), revealed by width so the reading column re-centres
 *             continuously; the bar's icon floats it back. The choice
 *             persists (localStorage) so the chat reopens the way this
 *             reader likes it.
 *
 * The xl-floating presentation and the phone's full-screen one are both
 * `CaseAskDock` (CaseAsk.tsx) — same screen, grown out of the resting pill
 * around the one composer (11 October 2026: the phone's old bottom sheet
 * mounted a second box, so its keyboard took a second tap).
 *
 * Every presentation is an ELEVATED LAYER, visibly apart from the page:
 * `bg-popover` (a step lighter than the page in dark mode), a border, and a
 * directional shadow — the demarcation the owner asked for.
 *
 * ── EXIT ANIMATIONS MUST HOLD THROUGH THE UNMOUNT GAP ──────────────────────
 * The host unmounts each surface ~40ms AFTER its 200ms exit animation ends.
 * When an animation ends without a fill, the element snaps back to committed
 * style — FULLY VISIBLE — for that gap (the owner's "closes, pops open,
 * closes again"; ~one frame on a fast machine, ~100ms on a busy one).
 * `[animation-fill-mode:forwards]` CANNOT fix this: `animate-out` is the
 * `animation:` SHORTHAND ending in `var(--tw-animation-fill-mode, none)`,
 * same specificity, later in the stylesheet — the shorthand resets the
 * longhand. `fill-mode-forwards` (tw-animate-css) is the working mechanism:
 * it sets the VARIABLE the shorthand reads, so the hold is part of the
 * animation itself. `motion-reduce:hidden` covers the no-animation path,
 * where the closed surface would otherwise sit fully visible until unmount.
 *
 * URL semantics are the host's (`CaseScreen`): `?chat={id}` / `?chat=new`,
 * pushed once so Back closes, in-panel hops replacing.
 */

interface CaseChatCommonProps {
  chatId: string;
  closing: boolean;
  subject: ChatSubject;
  signedIn: boolean;
  viewerId: number | null;
  /** The lifted create bundle — ONE instance in `CaseScreen`, every surface. */
  start: CaseChatStart;
  onClose: () => void;
  onSwitchChat: (chatId: string) => void;
}

/* ── Docked column (≥xl, by choice) ──────────────────────────────────────── */

export function CaseChatDocked({
  onFloat,
  ...props
}: CaseChatCommonProps & { onFloat: () => void }) {
  return (
    <aside
      aria-label={`Chat about this ${CHAT_SUBJECT_NOUN[props.subject.kind]}`}
      data-state={props.closing ? 'closed' : 'open'}
      className={cn(
        // The RAIL — transparent flow space (panel + right gutter). The
        // visible chat is the inset PANEL below: a rounded card standing off
        // the header, the screen edge, and the bottom (owner, July 31 — the
        // edge-to-edge column met the header in a hard T of borders, and its
        // big left shadow smeared the judgment; a card that touches nothing
        // has no seam to blend and needs almost no shadow). The gaps also
        // separate the transcript's scrollbar from the page's, so the two
        // rails stop reading as "two sidebars".
        'w-[calc(26rem+0.75rem)] shrink-0 overflow-x-clip',
        // The clipped width reveal — no translate past the viewport edge, so
        // no horizontal scrollbar; the reading column re-centres continuously.
        // The close shorthand carries its own `forwards`; `motion-reduce`
        // still needs the instant hide for the no-animation hold gap.
        'motion-safe:animate-[v2-case-chat-open_280ms_cubic-bezier(0.32,0.72,0,1)]',
        'data-[state=closed]:motion-safe:animate-[v2-case-chat-close_200ms_ease-in_forwards] data-[state=closed]:motion-reduce:hidden',
      )}
    >
      {/* 0.75rem gaps: sticky 0.75 below the header line, 100dvh − header
          (3.5rem) − two gaps (1.5rem) tall, and the rail's spare 0.75rem
          lands on the right. Panel stays 26rem — the family width — so the
          pill inside matches the floating card's to the pixel. */}
      <div className="sticky top-3 flex h-[calc(100dvh-5rem)] w-[26rem] flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-[0_18px_48px_-24px_rgba(0,0,0,0.35)]">
        <CaseChatBody {...props} onFloat={onFloat} />
      </div>
    </aside>
  );
}

/* ── The shared body: the one screen inside a frame ──────────────────────── */

function CaseChatBody({
  chatId,
  subject,
  signedIn,
  viewerId,
  start,
  onClose,
  onSwitchChat,
  onFloat,
}: CaseChatCommonProps & {
  onFloat: () => void;
}) {
  const stageRef = useRef<ConversationComposerHandle | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CaseChatBar
        subject={subject}
        view={chatId}
        onBack={() => onSwitchChat('new')}
        onClose={onClose}
        tall
        presentationAction={
          <button
            type="button"
            onClick={onFloat}
            aria-label="Float the chat over the page"
            title="Float over the page"
            className={cn(
              'v2-interactive flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
              FOCUS_RING,
            )}
          >
            <PanelRightClose aria-hidden className="size-4" />
          </button>
        }
      />
      <CaseChatMiddle
        view={chatId}
        subject={subject}
        signedIn={signedIn}
        viewerId={viewerId}
        onOpenChat={onSwitchChat}
        onClose={onClose}
        onStage={(text) => stageRef.current?.stage(text)}
      />
      {/* THE composer — pinned to the frame's bottom. Nothing focuses it on
          open: the keyboard comes up only when the reader taps it. */}
      <CaseChatComposerDock
        view={chatId}
        subject={subject}
        signedIn={signedIn}
        start={start}
        stageRef={stageRef}
      />
    </div>
  );
}

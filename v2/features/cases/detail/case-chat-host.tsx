'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type { ConversationComposerHandle } from '@/v2/features/conversations/conversation/ConversationComposer';
import { CaseChatMiddle } from './CaseChatCore';
import { createChatHostMemory, type ChatHostMemory, type MovableElement } from './chat-host-move';
import type { ChatSubject } from './chat-subject';

/**
 * case-chat-host — the case chat's middle (its conversation screen) rendered
 * ONCE per page, whichever frame shows it (Lucy, 25 October 2026; Stay chose
 * this, option B).
 *
 * The case page and the statute reader draw their chat floating (CaseAskDock)
 * or docked (CaseChatDocked). Each frame used to render its own middle, so a
 * move between them (Open on a draft, the auto-open as a draft finishes, the
 * dock and float buttons) unmounted the conversation screen, and the answer
 * still being written was lost with its stream.
 *
 * Now the page wraps its frames in {@link CaseChatHost}. It renders the middle
 * through a portal into one node it keeps for the page's life, and the frame
 * that shows draws a {@link CaseChatMiddleSlot}, which takes that node in. The
 * screen, its engine and its stream never unmount on a move; only the node
 * changes parent, and its scroll and focus are put back (chat-host-move.ts).
 * The bars and the composer stay each frame's own. The composer's handle (the
 * "Start with" chips fill it) is one object here, set by whichever frame's
 * composer is mounted.
 *
 * Without a host (any other page), the slot renders the middle itself, as
 * every frame did before.
 */

type StageHandle = { current: ConversationComposerHandle | null };

interface Host {
  node: HTMLDivElement;
  memory: ChatHostMemory;
  stage: StageHandle;
}

const CaseChatHostContext = createContext<Host | null>(null);

interface MiddleProps {
  view: string;
  subject: ChatSubject;
  signedIn: boolean;
  viewerId: number | null;
  onOpenChat: (conversationId: string) => void;
  onClose: () => void;
}

export function CaseChatHost({
  view,
  children,
  ...middle
}: Omit<MiddleProps, 'view'> & {
  /** The chat the page draws (`'new'` or a conversation id), or `null` for none. */
  view: string | null;
  children: ReactNode;
}) {
  // Made once, on the client. A plain object, not a ref: frames read it while
  // rendering to hand the composer its handle.
  const [host] = useState<Host | null>(() => {
    if (typeof document === 'undefined') return null;
    const node = document.createElement('div');
    node.className = 'flex min-h-0 flex-1 flex-col';
    node.setAttribute('data-v2-case-chat-host', '');
    return { node, memory: createChatHostMemory(node as unknown as MovableElement), stage: { current: null } };
  });

  // What to restore after a move: every scroll inside, and where focus is.
  useEffect(() => {
    if (!host) return;
    const { node, memory } = host;
    const onScroll = (event: Event) => memory.onScroll(event.target as unknown as MovableElement);
    const onFocusIn = (event: FocusEvent) => memory.onFocusIn(event.target as unknown as MovableElement);
    const onFocusOut = (event: FocusEvent) => memory.onFocusOut(event.relatedTarget as unknown as MovableElement | null);
    node.addEventListener('scroll', onScroll, true);
    node.addEventListener('focusin', onFocusIn);
    node.addEventListener('focusout', onFocusOut);
    return () => {
      node.removeEventListener('scroll', onScroll, true);
      node.removeEventListener('focusin', onFocusIn);
      node.removeEventListener('focusout', onFocusOut);
    };
  }, [host]);

  return (
    <CaseChatHostContext.Provider value={host}>
      {children}
      {/* After the frames, so the showing frame's slot has taken the node in
          before the screen's own effects run. */}
      {host && view !== null
        ? createPortal(
            <CaseChatMiddle view={view} {...middle} onStage={(text) => host.stage.current?.stage(text)} />,
            host.node,
          )
        : null}
    </CaseChatHostContext.Provider>
  );
}

/**
 * Where a frame shows the chat's middle. Under a {@link CaseChatHost} it takes
 * the page's one rendered middle in; elsewhere it renders the middle itself.
 */
export function CaseChatMiddleSlot(props: MiddleProps & { onStage: (text: string) => void }) {
  const host = useContext(CaseChatHostContext);
  const attach = useCallback(
    (slot: HTMLDivElement | null) => {
      if (!slot || !host) return;
      host.memory.attach(
        slot as unknown as MovableElement,
        () => document.activeElement === null || document.activeElement === document.body,
        host.node.parentElement === slot,
      );
    },
    [host],
  );
  if (!host) return <CaseChatMiddle {...props} />;
  return <div ref={attach} data-v2-case-chat-slot="" className="flex min-h-0 flex-1 flex-col" />;
}

/**
 * The composer handle a frame gives its composer: the host's one handle when
 * there is a host (the middle's chips fill whichever composer is mounted), else
 * `null`, and the frame keeps its own.
 */
export function useCaseChatStage(): StageHandle | null {
  return useContext(CaseChatHostContext)?.stage ?? null;
}

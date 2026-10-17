import { useSyncExternalStore } from 'react';

import type { MessageAttachment, MessageReplyTo } from '@/types/chat';
import type { JurisdictionChoice } from '@/types/jurisdiction';
import type { MentionOptions } from '@/v2/features/channels/model';
import type { QuoteTone } from './reply-target';
import type { SendRefused, ViewOnlyReason } from './space-turn';

/**
 * route-composer — the seam between a chat's screen on its own route (`/c/{id}`)
 * and the one message box the shell docks under it (`ChatDock`, message box B,
 * Stay, 17 October 2026: "the cleaner one").
 *
 * WHY THE BOX LEFT THE SCREEN. The box used to be part of `ConversationScreen`,
 * and so of the route's content. A tap on a chat paints the move-first frame
 * first, then the route's loading screen, then the screen: three trees, each
 * deleted by the next, so the box was a grey skeleton in the first two and a
 * new element in the third. The shell's dock outlives all three, so the box
 * there is one element from the tap to the answer, and what the reader types in
 * the first frame is still in it when the chat is ready.
 *
 * THE SCREEN STILL OWNS THE CHAT. Its controller holds the stream, the ruling
 * and the send. It PUBLISHES what the box needs here, and the dock CONSUMES it:
 * the `embedded-composer.ts` idiom (the case chat's host composer), with its
 * own store, because the case page and a chat route are two hosts with two
 * lifetimes. A module-level external store, `useSyncExternalStore`, stable
 * snapshots, effect-time writes (React Compiler-clean). One chat route is open
 * at a time, and every read and clear is guarded by the conversation's id, so a
 * late clear from a screen that is leaving never blanks its successor.
 *
 * Refused follow-ups keep `reportFollowUpRefusal` (embedded-composer.ts): it is
 * per conversation, so the dock listens to it the way the case host does. A
 * Reply to a message is the one event the screen sends the box itself
 * (`stageRouteReply`), so the caret lands in the box with the quote.
 */

/** What a chat's screen offers the docked box, per render. */
export interface RouteComposerSurface {
  /** The publishing chat: the dock shows this only while it targets that id. */
  conversationId: string;
  /** The chat cannot be written to at all (gone, or a lost confidential
   *  copy): the dock draws nothing. */
  terminal: boolean;
  /** The first moments of a cold wait draw nothing, box included
   *  (skeleton-hold.ts). */
  holdingSkeleton: boolean;
  /** False while whose chat it is is still unknown: the dock draws the box's
   *  skeleton. */
  isOwnerResolved: boolean;
  /** The reader may send: else the dock draws the view-only strip. */
  canSend: boolean;
  viewOnlyReason: ViewOnlyReason;
  /** The history is still loading: the box takes typing, Send waits. */
  holdSend: boolean;
  /** The reader has scrolled up: the country chip folds away (#16). */
  showMeta: boolean;
  jurisdiction: JurisdictionChoice;
  setJurisdiction: (next: JurisdictionChoice) => void;
  isConfidential: boolean;
  isRedacted: boolean;
  isStreaming: boolean;
  isCancelling: boolean;
  sendHeldBy: string | null;
  canStop: boolean;
  submit: (
    message: string,
    attachments: MessageAttachment[],
    replyTo: MessageReplyTo | null,
  ) => Promise<SendRefused | undefined>;
  stop: () => void;
  mentionOptions: MentionOptions | null;
  quoteToneOf: ((replyTo: MessageReplyTo) => QuoteTone) | null;
  spaceUuid: string | null;
}

let surface: RouteComposerSurface | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot(): RouteComposerSurface | null {
  return surface;
}

function getServerSnapshot(): RouteComposerSurface | null {
  return null;
}

/** Equal when every field is the same value or the same function. */
function sameSurface(a: RouteComposerSurface, b: RouteComposerSurface): boolean {
  const keys = Object.keys(b) as (keyof RouteComposerSurface)[];
  return keys.length === Object.keys(a).length && keys.every((key) => a[key] === b[key]);
}

/** Publish the screen's surface. Idempotent: an equal surface is a no-op. */
export function publishRouteComposer(next: RouteComposerSurface): void {
  if (surface !== null && sameSurface(surface, next)) return;
  surface = next;
  emit();
}

/** Retract it, from the screen's unmount, with its own id (see the docblock). */
export function clearRouteComposer(conversationId: string): void {
  if (surface === null || surface.conversationId !== conversationId) return;
  surface = null;
  emit();
}

/** The dock's read: the surface while it belongs to `conversationId`, else
 *  `null` (the screen has not published yet, or another chat's is stale). */
export function useRouteComposerSurface(conversationId: string | null): RouteComposerSurface | null {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (conversationId === null || current === null) return null;
  return current.conversationId === conversationId ? current : null;
}

/* ── A Reply, handed to the box ──────────────────────────────────────────── */

const replyListeners = new Set<(conversationId: string, target: MessageReplyTo) => void>();

/** Put a reply's quote in the docked box and the caret with it. The draft
 *  store holds the quote as well (the screen writes it), for a box that is
 *  not mounted yet. */
export function stageRouteReply(conversationId: string, target: MessageReplyTo): void {
  for (const listener of replyListeners) listener(conversationId, target);
}

/** The dock's side, from an effect. Returns the unsubscribe. */
export function subscribeRouteReplies(
  conversationId: string,
  onReply: (target: MessageReplyTo) => void,
): () => void {
  const listener = (id: string, target: MessageReplyTo) => {
    if (id === conversationId) onReply(target);
  };
  replyListeners.add(listener);
  return () => {
    replyListeners.delete(listener);
  };
}

import { useSyncExternalStore } from 'react';
import type { MessageAttachment } from '@/types/chat';
import type { JurisdictionChoice } from '@/types/jurisdiction';

/**
 * embedded-composer — the seam that lets a HOST surface own the one composer
 * while an embedded `ConversationScreen` owns the conversation.
 *
 * WHY (owner, July 31: "everything on the first screen — the same text area").
 * The case chat is ONE screen whose middle swaps between the new-chat content
 * and the transcript; the composer at the bottom is ONE mounted element in
 * both states. That element cannot live inside `ConversationScreen` (it must
 * survive the conversation unmounting), and the conversation's send/stop/
 * streaming state cannot flow to it through the tree (they'd meet only at a
 * common ancestor via setState-in-effect chains). So the embedded screen
 * PUBLISHES its composer-facing surface here, and the host's composer dock
 * CONSUMES it — the exact `header-context.ts` idiom: a module-level external
 * store, `useSyncExternalStore`, referentially-stable snapshots, effect-time
 * writes (legal under the React Compiler lint where effect setState is not).
 *
 * A module-level singleton is CORRECT, not a shortcut: the host mounts at most
 * one embedded conversation at a time (two would be two live controllers on
 * one stream — the case chat's standing rule), and consumers guard staleness
 * by id, so a late clear from an unmounting publisher can never blank a new
 * publisher's surface.
 */

/** What the embedded conversation offers the host's composer, per render. */
export interface EmbeddedComposerSurface {
  /** The publishing conversation — consumers match this against their open id. */
  conversationId: string;
  jurisdiction: JurisdictionChoice;
  setJurisdiction: (next: JurisdictionChoice) => void;
  isConfidential: boolean;
  isRedacted: boolean;
  isStreaming: boolean;
  isCancelling: boolean;
  /** Server-verified ownership — false ⇒ the host shows its view-only strip. */
  isOwner: boolean;
  /** False while ownership is still resolving — the host disables sending. */
  isOwnerResolved: boolean;
  submit: (message: string, attachments: MessageAttachment[]) => Promise<void>;
  stop: () => void;
}

let surface: EmbeddedComposerSurface | null = null;
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

function getSnapshot(): EmbeddedComposerSurface | null {
  return surface;
}

function getServerSnapshot(): EmbeddedComposerSurface | null {
  return null;
}

/** Publish the embedded conversation's surface. Idempotent — equal values are a no-op. */
export function publishEmbeddedComposer(next: EmbeddedComposerSurface): void {
  if (
    surface !== null &&
    surface.conversationId === next.conversationId &&
    surface.jurisdiction === next.jurisdiction &&
    surface.setJurisdiction === next.setJurisdiction &&
    surface.isConfidential === next.isConfidential &&
    surface.isRedacted === next.isRedacted &&
    surface.isStreaming === next.isStreaming &&
    surface.isCancelling === next.isCancelling &&
    surface.isOwner === next.isOwner &&
    surface.isOwnerResolved === next.isOwnerResolved &&
    surface.submit === next.submit &&
    surface.stop === next.stop
  ) {
    return;
  }
  surface = next;
  emit();
}

/**
 * Retract the surface — call from the publisher's unmount cleanup, with its own
 * id so an unmount that races a successor's mount can never clear the successor.
 */
export function clearEmbeddedComposer(conversationId: string): void {
  if (surface === null || surface.conversationId !== conversationId) return;
  surface = null;
  emit();
}

/**
 * The host's read: the published surface, but only while it belongs to the
 * conversation the host currently has open — a stale or foreign surface reads
 * as `null` (the host treats that as "conversation still wiring up").
 */
export function useEmbeddedComposerSurface(
  conversationId: string | null,
): EmbeddedComposerSurface | null {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (conversationId === null || current === null) return null;
  return current.conversationId === conversationId ? current : null;
}

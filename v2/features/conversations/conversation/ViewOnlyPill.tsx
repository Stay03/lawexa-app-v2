import { Eye } from 'lucide-react';

import { VIEW_ONLY_COPY, type ViewOnlyReason } from './space-turn';

/**
 * Read-only footer for a reader who may not send (§C KEEP): a shared link,
 * or a Viewer of the chat's space (backend B4). "View only" over the reason,
 * so it is two lines and rounds as a card, not a pill. Matches the composer's
 * compact width so the floating bar keeps one silhouette.
 *
 * Its own module so an external-composer host (the case chat's dock) can
 * render it in its own dock without importing `ConversationScreen`, which the
 * case page loads only once a conversation opens (`CaseChatCore`).
 */
export function ViewOnlyPill({ reason }: { reason: ViewOnlyReason }) {
  return (
    <div className="mx-auto w-full max-w-xs px-4 pb-3 pt-2 sm:max-w-md">
      <div className="bg-muted/80 text-muted-foreground flex items-center justify-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm backdrop-blur">
        <Eye className="h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-foreground font-medium">{VIEW_ONLY_COPY.title}</p>
          <p className="text-xs">{VIEW_ONLY_COPY[reason]}</p>
        </div>
      </div>
    </div>
  );
}

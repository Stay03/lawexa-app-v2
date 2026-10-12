import { Eye } from 'lucide-react';

/**
 * Read-only footer for a shared conversation the viewer doesn't own (§C KEEP).
 * Matches the pill's compact width so the floating bar keeps one silhouette.
 *
 * Its own module so an external-composer host (the case chat's dock) can
 * render it in its own dock without importing `ConversationScreen`, which the
 * case page loads only once a conversation opens (`CaseChatCore`).
 */
export function ViewOnlyPill() {
  return (
    <div className="mx-auto w-full max-w-xs px-4 pb-3 pt-2 sm:max-w-md">
      <div className="bg-muted/80 text-muted-foreground flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-center text-sm backdrop-blur">
        <Eye className="h-4 w-4 shrink-0" />
        View only — this is a shared conversation
      </div>
    </div>
  );
}

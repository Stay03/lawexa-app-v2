/**
 * case-draft-move — the floating case chat moving to the dock when a draft
 * opens (Stay, 24 October 2026, option 1: "Move to the right").
 *
 * The floating card (CaseAskDock) and the docked one (CaseChatDocked) are two
 * elements: one presentation unmounts and the other mounts. To the reader it
 * is one card that slides right and grows up to the full height, while the
 * reading column slides left to its docked place, and the draft editor is
 * uncovered over it (ChatSidePanel's card wipe). A FLIP: the open measures the
 * card and the column where they are (`measureFloatingChat`), the docked
 * layout is committed, and before its first paint (`playMoveToDock`, from a
 * layout effect) each element is put back where it was and animated home.
 *
 *   the card    translated from the floating card's left, and clipped at the
 *               floating card's top, so it grows upward from the same bottom
 *               (both stand 0.75rem above the screen's foot)
 *   the column  translated from where it stood centred
 *
 * The docked rail's own entry (a width reveal) is cancelled for this one
 * mount, and its clip is lifted for the move, or the card would be cut off
 * while it is still on its way in. The Web Animations API leaves nothing on
 * the elements when it ends. With reduced motion nothing is measured or
 * played: the chat is docked at once.
 */

/** Where the floating chat and the reading column stood before the move. */
export interface FloatingChatPlace {
  card: DOMRect;
  column: DOMRect;
}

/** The slide's length and curve: one ease in and out, as in the approved motion. */
export const DOCK_MOVE_MS = 520;
const DOCK_MOVE_EASING = 'cubic-bezier(0.65, 0, 0.35, 1)';

/** The floating card's place and the column's, or `null` when there is nothing to play. */
export function measureFloatingChat(column: HTMLElement | null): FloatingChatPlace | null {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  const card = document.querySelector<HTMLElement>('[data-v2-case-ask-card]');
  if (!card || !column) return null;
  return { card: card.getBoundingClientRect(), column: column.getBoundingClientRect() };
}

/** Plays the move onto the docked chat that has just been committed. */
export function playMoveToDock(from: FloatingChatPlace, column: HTMLElement | null): void {
  const rail = document.querySelector<HTMLElement>('[data-v2-case-docked]');
  const card = rail?.querySelector<HTMLElement>('[data-v2-case-docked-card]');
  if (!rail || !card) return;

  for (const animation of rail.getAnimations()) animation.cancel();
  const timing: KeyframeAnimationOptions = { duration: DOCK_MOVE_MS, easing: DOCK_MOVE_EASING };
  rail.animate([{ overflowX: 'visible' }, { overflowX: 'visible' }], timing);

  const to = card.getBoundingClientRect();
  const top = Math.max(0, from.card.top - to.top);
  card.animate(
    [
      {
        transform: `translateX(${from.card.left - to.left}px)`,
        clipPath: `inset(${top}px 0 0 0 round 1rem)`,
      },
      { transform: 'translateX(0)', clipPath: 'inset(0 0 0 0 round 1rem)' },
    ],
    timing,
  );

  if (column) {
    const now = column.getBoundingClientRect();
    column.animate(
      [{ transform: `translateX(${from.column.left - now.left}px)` }, { transform: 'translateX(0)' }],
      timing,
    );
  }
}

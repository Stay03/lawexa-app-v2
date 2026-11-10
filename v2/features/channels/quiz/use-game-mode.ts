'use client';

import { useEffect } from 'react';

import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';

/**
 * useGameMode — a room's live game as a MODE over the screen, addressed by
 * `?game={uuid}`: a channel, a Space's page, or a Space chat (live quiz in
 * Spaces, 10 November 2026; until then the channel screen's own code).
 *
 * Its OWN param, not a `?panel=` value: a game is a mode that covers the
 * screen, and a panel may be open behind it. The SSR fallback is real here
 * because `GameOverlay` renders IN TREE — an overlay that only ever portals
 * can hydrate from the URL alone. `canOpen` is the screen's gate: only a
 * reader who may play there reaches the branch that renders the overlay, so
 * only theirs ever asks the quiz endpoints for anything.
 *
 * THE NAVIGATION'S `?game=` IS ADOPTED WHENEVER IT ARRIVES, not only when the
 * screen is born — which is what makes the go-live notification work for its
 * likeliest recipient.
 *
 * `ssrValue` alone could never do it. It is consulted only where there is no
 * `window`, so on the client the hook reads the LIVE URL — once, in its lazy
 * initialiser — and `popstate` is its only other adopter. Neither fires for the
 * reader who is already on the room when a quiz starts there: the bell pushes
 * `{room}?game={game}`, the route shell keys the screen by its id so React does
 * NOT remount it, and a push is not a pop. The overlay stayed `null` and the
 * address bar kept a `?game=` nothing on screen answered to — until some
 * unrelated panel's `close()` walked back over an entry carrying it and sprang
 * the game open minutes later. The prop is the one signal that does change, so
 * the prop is what this reads.
 *
 * AN EFFECT, NOT A RENDER-PHASE ADJUST, and the reason is timing. Next applies a
 * navigation's URL in `HistoryUpdater`'s `useInsertionEffect` — after the render
 * pass that delivered these props — so during that render `window.location`
 * still reads the PREVIOUS address. Adopting from render would therefore be
 * read straight back as stripped (the hook re-checks the live URL every render),
 * and calling `show` from render would find no `?game=` yet and quietly PUSH one
 * — a history write from a render, and a duplicate entry for Back to land on and
 * re-open the game from. By the time an effect runs, the insertion effect has
 * already moved the address bar, so `show` finds the live URL equal to the value
 * and returns having touched no history at all: it only adopts into state.
 *
 * IT CANNOT RE-OPEN A GAME THE READER CLOSED. Its only trigger is a CHANGE of
 * `initialGameUuid`, and that is a navigation-time prop: closing the overlay is a
 * quiet history write, which by construction never reaches the App Router and so
 * never re-renders the page with new props. A dismissal is final.
 *
 * `canOpen` STILL RULES. `show` refuses a value this reader may not open, so a
 * previewer's deep link degrades to the screen's honest line rather than to a
 * lobby they cannot enter.
 *
 * KNOWN LIMIT, stated rather than hidden: re-delivering the SAME uuid changes no
 * prop, so clicking the same bell row twice after dismissing that same lobby
 * will not re-open it. Covering it needs a per-navigation signal the screen
 * does not have; re-arming whenever the overlay goes empty would re-open the
 * game the instant the reader closed it, because `close()`'s `history.back()`
 * has not landed yet.
 */
export function useGameMode({
  initialGameUuid,
  canOpen,
}: {
  /** The navigation's `?game=`, from the page (null without one). */
  initialGameUuid: string | null;
  /** Whether this reader may open a game here; undefined while not known. */
  canOpen: boolean | undefined;
}): { gameUuid: string | null; showGame: (gameUuid: string) => void; closeGame: () => void } {
  const game = useUrlOverlay('game', { ssrValue: initialGameUuid, canOpen });
  const { show: showGame, close: closeGame } = game;

  useEffect(() => {
    if (initialGameUuid === null) return;
    showGame(initialGameUuid);
  }, [initialGameUuid, showGame]);

  return { gameUuid: game.value, showGame, closeGame };
}

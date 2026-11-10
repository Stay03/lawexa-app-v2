'use client';

import { useCallback, useMemo, useState } from 'react';

import { canHostInSpace } from './model';
import { spaceRoom, type QuizRoom } from './quiz-room';
import type { QuizHostPlace } from './QuizLibrarySheet';
import { useGameMode } from './use-game-mode';
import { useSpaceQuizLive } from './use-space-quiz-live';

/**
 * The Space as a live quiz needs it, whichever screen read it: the Space's
 * page (from the Space) or one of its chats (from the chat's record).
 */
export interface SpaceQuizSeat {
  uuid: string;
  name: string;
  /** Whether the reader is an active member: who watches and plays. */
  isMember: boolean;
  /** The reader's content role in the Space (`owner`, `editor`, `viewer`), or null. */
  contentRole: string | null;
}

/**
 * useSpaceLiveQuiz — a Space's live quiz on whatever screen shows the Space:
 * its page, or one of its chats (live quiz in Spaces, Arthur's decisions
 * 93142269; Backend's shapes 7a007a8c).
 *
 * The rules, decided here once for both screens:
 *   - any active member watches and plays, so only they hear the Space's games
 *     and open `?game=`;
 *   - the Space's Owner and Contributors host (`canHostInSpace`); anyone
 *     else's host sheet says so;
 *   - one live game per Space, which the room's probe and live bar show;
 *   - a game hosted from a chat names it, where its live and finished lines go.
 *
 * The screen draws what it returns where it fits: the live bar inline, the
 * host sheet, and the game overlay over the screen (`GameOverlay`).
 */
export function useSpaceLiveQuiz({
  seat,
  conversationUuid,
  initialGameUuid,
}: {
  /** The Space and the reader's place in it: undefined while that is not known
   *  yet, null where there is no Space (a chat of the reader's own). */
  seat: SpaceQuizSeat | null | undefined;
  /** The chat it is shown in, or null on the Space's page. */
  conversationUuid: string | null;
  /** The navigation's `?game=`. */
  initialGameUuid: string | null;
}): {
  room: QuizRoom | null;
  isMember: boolean;
  /** Whether this reader may host here: the Space's Owner or a Contributor. */
  mayHost: boolean;
  hostPlace: QuizHostPlace | null;
  gameUuid: string | null;
  openGame: (gameUuid: string) => void;
  closeGame: () => void;
  hostOpen: boolean;
  setHostOpen: (open: boolean) => void;
} {
  const spaceUuid = seat?.uuid ?? null;
  const spaceName = seat?.name ?? '';
  const isMember = seat?.isMember ?? false;
  const mayHost = isMember && canHostInSpace(seat?.contentRole);

  const room = useMemo(() => (spaceUuid ? spaceRoom(spaceUuid) : null), [spaceUuid]);
  const hostPlace = useMemo<QuizHostPlace | null>(
    () =>
      spaceUuid
        ? { kind: 'space', space: { uuid: spaceUuid, name: spaceName }, mayHost, conversationUuid }
        : null,
    [spaceUuid, spaceName, mayHost, conversationUuid],
  );

  useSpaceQuizLive(spaceUuid, isMember);
  // Undefined until the Space has landed: gating on a membership not yet
  // known would strip a real member's `?game=` link before it could work.
  const { gameUuid, showGame, closeGame } = useGameMode({
    initialGameUuid,
    canOpen: seat === undefined ? undefined : isMember,
  });

  const [hostOpen, setHostOpen] = useState(false);
  /** Into the game: the host sheet closes first, so it never sits under the mode. */
  const openGame = useCallback(
    (next: string) => {
      setHostOpen(false);
      showGame(next);
    },
    [showGame],
  );

  return { room, isMember, mayHost, hostPlace, gameUuid, openGame, closeGame, hostOpen, setHostOpen };
}

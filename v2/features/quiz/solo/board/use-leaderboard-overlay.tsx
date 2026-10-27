'use client';

import { useCallback, useState } from 'react';

import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import { QuizLeaderboardSheet } from './QuizLeaderboardSheet';

const BOARD_PARAM = 'board';

/**
 * The leaderboard sheet behind its own address, `?board={quizUuid}`, so the
 * device's Back closes it like every v2 overlay and a board is a link. One
 * sheet per screen: `openBoard` names the quiz, and `sheet` is mounted once.
 *
 * Keyed per opening and mounted through its close (the house dialog
 * contract, `use-url-overlay.ts`): the exit plays, and every arrival is a
 * fresh mount. The title of the quiz last opened is kept past the close, so
 * the heading does not empty while the sheet slides away; a board opened
 * from a link names no quiz until its rows are read.
 */
export function useLeaderboardOverlay(viewerId: number | null) {
  const overlay = useUrlOverlay(BOARD_PARAM);
  const [titles, setTitles] = useState<Readonly<Record<string, string>>>({});
  const [lastUuid, setLastUuid] = useState<string | null>(null);
  const { show, close } = overlay;

  const openBoard = useCallback(
    (quizUuid: string, quizTitle: string) => {
      setTitles((known) => (known[quizUuid] === quizTitle ? known : { ...known, [quizUuid]: quizTitle }));
      setLastUuid(quizUuid);
      show(quizUuid);
    },
    [show],
  );

  const quizUuid = overlay.value ?? lastUuid;
  const sheet = quizUuid ? (
    <QuizLeaderboardSheet
      key={overlay.keyFor(quizUuid)}
      quizUuid={quizUuid}
      quizTitle={titles[quizUuid] ?? null}
      open={overlay.open}
      onOpenChange={(next) => (next ? show(quizUuid) : close())}
      viewerId={viewerId}
    />
  ) : null;

  return { openBoard, sheet };
}

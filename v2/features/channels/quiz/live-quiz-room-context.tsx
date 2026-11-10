'use client';

import { createContext, useContext } from 'react';

import type { QuizRoom } from './quiz-room';

/**
 * The live quiz room a transcript sits in, for the rows deep inside it that
 * draw a game's line (a Space chat's `quiz_game_live` and `quiz_game_finished`
 * rows). The screen that owns the game mode provides it; outside one (a
 * chat of the reader's own, a reader who is not a member) there is none, and
 * a line draws its sentence alone.
 */
export interface LiveQuizRoomValue {
  room: QuizRoom;
  viewerId: number | null;
  /** Opens the room's game mode (screen-owned; `?game=`). */
  openGame: (gameUuid: string) => void;
}

const LiveQuizRoomContext = createContext<LiveQuizRoomValue | null>(null);

export const LiveQuizRoomProvider = LiveQuizRoomContext.Provider;

export function useLiveQuizRoom(): LiveQuizRoomValue | null {
  return useContext(LiveQuizRoomContext);
}

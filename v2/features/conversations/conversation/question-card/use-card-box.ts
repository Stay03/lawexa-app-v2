'use client';

import { useState, type RefObject } from 'react';

import type { BoxAnswering } from '@/lib/utils/question-card';
import type { MessageAttachment } from '@/types/chat';
import type { SendRefused } from '../space-turn';
import type { OpenCard } from './open-card';
import type { QuestionDockHandle } from './QuestionDock';

/** The card's key, as its host keys its QuestionDock: a new card starts fresh. */
function openCardKey(open: OpenCard): string {
  return String(open.cardMessageId ?? open.rowId);
}

/**
 * The message box and the open question card as one (question cards, design A
 * V3): while "Something else" is on, the box is the card's field, so its hint
 * and its arrow's name come from the card, and its send is the card's answer.
 * A card that closes, or a new one, gives the box back as a reply box.
 *
 * `dock` is the host's ref on its QuestionDock, read only when the box sends.
 */
export function useCardBox(open: OpenCard | null, dock: RefObject<QuestionDockHandle | null>) {
  const [state, setState] = useState<{ card: string; answering: BoxAnswering } | null>(null);
  const card = open ? openCardKey(open) : null;
  const answering = state !== null && state.card === card ? state.answering : null;

  const onBoxAnswering = (next: BoxAnswering | null) =>
    setState(next === null || card === null ? null : { card, answering: next });

  /** The box's send while it answers: the card records the words, or gives them back with a reason. */
  const answer = (message: string, attachments: MessageAttachment[]): Promise<SendRefused | undefined> =>
    dock.current ? dock.current.answer(message, attachments) : Promise.resolve({ refused: '' });

  return { answering, onBoxAnswering, answer };
}

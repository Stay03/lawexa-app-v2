'use client';

import { useEffect, useState, type CSSProperties, type RefObject } from 'react';

import type { BoxAnswering } from '@/lib/utils/question-card';
import type { MessageAttachment } from '@/types/chat';
import type { SendRefused } from '../space-turn';
import { lockSurvivesResize, STACK_MAX_HEIGHT } from './card-height';
import type { OpenCard } from './open-card';
import type { QuestionDockHandle } from './QuestionDock';

/** The card's key, as its host keys its QuestionDock: a new card starts fresh. */
function openCardKey(open: OpenCard): string {
  return String(open.cardMessageId ?? open.rowId);
}

/**
 * The message box and the open question card as one (question cards, design A
 * V3): while "Type my own answer" is on, the box is the card's field, so its hint
 * and its arrow's name come from the card, and its send is the card's answer.
 * A card that closes, or a new one, gives the box back as a reply box.
 *
 * THE STACK. The host wraps the card and the box in one element (its own ref,
 * passed to the card, and `stackStyle`). While the box answers, the stack keeps the height it had when
 * the box opened (`onStackLock`, set by the card), so the card's top edge
 * never moves (see `lockSurvivesResize`).
 *
 * `dock` is the host's ref on its QuestionDock, read only when the box sends.
 */
export function useCardBox(open: OpenCard | null, dock: RefObject<QuestionDockHandle | null>) {
  const [state, setState] = useState<{ card: string; answering: BoxAnswering } | null>(null);
  const [lock, setLock] = useState<{ card: string; height: number } | null>(null);
  const card = open ? openCardKey(open) : null;
  // A card that closes takes its answering box and its lock with it, so the
  // same card coming back (null, then the same key) starts folded and free.
  if (card === null && (state !== null || lock !== null)) {
    setState(null);
    setLock(null);
  }
  const answering = state !== null && state.card === card ? state.answering : null;
  const stackLock = lock !== null && lock.card === card ? lock.height : null;

  const onBoxAnswering = (next: BoxAnswering | null) =>
    setState(next === null || card === null ? null : { card, answering: next });

  /** The card's call, inside its flush: the stack's height to keep while the box answers, or null to let it go. */
  const onStackLock = (height: number | null) => setLock(height === null || card === null ? null : { card, height });

  // A turn of the phone drops the lock; a keyboard opening (height alone) keeps it.
  useEffect(() => {
    if (stackLock === null) return;
    let size = { width: window.innerWidth, height: window.innerHeight };
    const onResize = () => {
      const next = { width: window.innerWidth, height: window.innerHeight };
      if (!lockSurvivesResize(size, next)) setLock(null);
      size = next;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [stackLock]);

  /** The box's send while it answers: the card records the words, or gives them back with a reason. */
  const answer = (message: string, attachments: MessageAttachment[]): Promise<SendRefused | undefined> =>
    dock.current ? dock.current.answer(message, attachments) : Promise.resolve({ refused: '' });

  const stackStyle: CSSProperties | undefined =
    stackLock !== null ? { height: stackLock, maxHeight: STACK_MAX_HEIGHT } : undefined;

  return { answering, onBoxAnswering, answer, stackStyle, stackLocked: stackLock !== null, onStackLock };
}

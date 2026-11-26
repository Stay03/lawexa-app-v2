import { useEffect, useState, useSyncExternalStore } from 'react';
import { DictationController, type DictationHandlers, type DictationState } from './dictation-controller';

/**
 * One dictation controller for the life of a message box. The box reads its
 * state as an external store; the handlers are handed over after each render,
 * so a send reads the box's latest draft. Leaving the box closes the
 * microphone and drops the words.
 */
export function useDictation(handlers: DictationHandlers): { state: DictationState; dictation: DictationController } {
  const [dictation] = useState(() => new DictationController());
  const state = useSyncExternalStore(dictation.subscribe, dictation.getSnapshot, dictation.getSnapshot);

  useEffect(() => {
    dictation.connect(handlers);
  });

  useEffect(() => () => dictation.dispose(), [dictation]);

  return { state, dictation };
}

/** Whether the box is taken by a dictation (its words and controls in place of the typing row). */
export function isDictating(state: DictationState): boolean {
  return state.phase === 'starting' || state.phase === 'listening' || state.phase === 'paused' || state.phase === 'countdown';
}

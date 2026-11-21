'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import type { RecordingTargetInput } from '@/types/recording';
import { RecorderController, type RecorderState } from './recorder-controller';

const keyOf = (target: RecordingTargetInput) =>
  'conversation_uuid' in target ? `c:${target.conversation_uuid}` : `s:${target.space_uuid}:${target.channel_uuid}:${target.thread_uuid ?? ''}`;

/**
 * The recorder for one chat or Space thread. A new controller when the target
 * changes (the composer stays mounted between chats); the old one lets its
 * microphone, live socket and timers go.
 */
export function useRecorder(target: RecordingTargetInput): { state: RecorderState; recorder: RecorderController } {
  const key = keyOf(target);
  const [entry, setEntry] = useState(() => ({ key, recorder: new RecorderController(target) }));
  // Another chat: a fresh recorder, set during render (React's "adjust state when a prop changes").
  if (entry.key !== key) setEntry({ key, recorder: new RecorderController(target) });
  const { recorder } = entry;
  useEffect(() => () => recorder.dispose(), [recorder]);
  const state = useSyncExternalStore(recorder.subscribe, recorder.getSnapshot, recorder.getSnapshot);
  return { state, recorder };
}

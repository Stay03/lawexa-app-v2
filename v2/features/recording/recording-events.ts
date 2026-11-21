import type { RecordingUpdatedEvent } from '@/types/recording';

/**
 * The `.recording.updated` broadcast (Backend, 21 November 2026: on the
 * person's private channel, at each stage after Stop), passed from the
 * realtime spine to an open recorder. The recorder also reads the stage every
 * few seconds, so a missed broadcast only slows the card down.
 */
const listeners = new Set<(event: RecordingUpdatedEvent) => void>();

export function onRecordingUpdated(listener: (event: RecordingUpdatedEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitRecordingUpdated(event: RecordingUpdatedEvent): void {
  for (const listener of listeners) listener(event);
}

import type { RecordingFileRef, RecordingMessageMeta } from '@/types/recording';

/**
 * A finished recording's card, from the message the server posts for it
 * (`metadata.type` "recording", role user, the person who recorded as author;
 * Backend, 21 November 2026). Null for any other message, or one without its
 * recording's id.
 */
export function readRecordingMeta(metadata: unknown): RecordingMessageMeta | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const meta = metadata as Record<string, unknown>;
  if (meta.type !== 'recording' || typeof meta.recording_uuid !== 'string') return null;
  const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  const file = (value: unknown): RecordingFileRef | null => {
    if (!value || typeof value !== 'object') return null;
    const entry = value as Record<string, unknown>;
    if (typeof entry.id !== 'number' || typeof entry.name !== 'string') return null;
    return {
      id: entry.id,
      name: entry.name,
      size: number(entry.size) ?? 0,
      ...(typeof entry.mime_type === 'string' && { mime_type: entry.mime_type }),
    };
  };
  return {
    recording_uuid: meta.recording_uuid,
    duration_seconds: number(meta.duration_seconds),
    speaker_count: number(meta.speaker_count),
    audio_file: file(meta.audio_file),
    transcript_file: file(meta.transcript_file),
  };
}

import type { ToolMessage } from '@/types/chat';

/**
 * chat-recording — a call Lawexa recorded on its machine, as the chat's
 * recording card draws it (call recordings, Techlead's go, 13 November 2026).
 *
 * READ FROM THE STEP'S OWN RESULT, the body box_record_stop answered with
 * (lawexa-api BoxToolController::recordStop and UserBoxService::recordStop,
 * API 31955cc4): `file_id`, `name` ("Call recording 2026-11-13 10.35
 * UTC.ogg"), `url` (a 60-minute link, never used here), `seconds`, `bytes`
 * and `reason`. The recording is the person's own File (category media,
 * audio/ogg), so the card plays it by `file_id` and the player asks for a
 * fresh link of its own: the card still plays a day later.
 *
 * Every field is read defensively: a result without a file id gives no card.
 */

export const RECORD_START_TOOL = 'box_record_start';
export const RECORD_STOP_TOOL = 'box_record_stop';

export interface ChatRecording {
  fileId: number;
  name: string;
  /** "22 min", or `null` when the result carried no length. */
  length: string | null;
}

export function isRecordingStep(message: ToolMessage): boolean {
  return message.toolName === RECORD_STOP_TOOL;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * The recording a finished box_record_stop step saved, or `null` when the
 * step is another tool, has not finished, failed, its result is not loaded
 * yet, or names no file.
 */
export function chatRecording(message: ToolMessage): ChatRecording | null {
  if (!isRecordingStep(message) || message.toolStatus !== 'complete') return null;
  if (message.toolResult?.success === false) return null;
  const top = record(message.toolResult?.data);
  const data = record(top?.data) ?? top;
  if (!data) return null;
  const fileId = data.file_id;
  if (typeof fileId !== 'number' || !Number.isSafeInteger(fileId) || fileId <= 0) return null;
  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Call recording';
  return { fileId, name, length: recordingLength(data.seconds) };
}

/**
 * A recording's length in words: "42 s" under a minute, "22 min" under an
 * hour, "1 h 5 min" beyond, rounded to the nearest minute; `null` for a
 * length that is not a number of seconds.
 */
export function recordingLength(seconds: unknown): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** The step lines: what Lawexa is doing, then what it did. */
export function recordingStepAction(toolName: string, isComplete: boolean): string | null {
  if (toolName === RECORD_START_TOOL) return isComplete ? 'Started recording' : 'Starting to record...';
  if (toolName === RECORD_STOP_TOOL) return isComplete ? 'Saved the recording' : 'Saving the recording...';
  return null;
}

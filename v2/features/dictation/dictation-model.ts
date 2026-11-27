import { startProblemLine, type StartProblem } from '../recording/recording-model';
import { readCommand, type DictationCommand } from './commands';

/**
 * dictation-model — the rules of one dictation in the message box (Arthur,
 * 25 November 2026, design A2), kept pure so they are tested without a
 * microphone. The controller feeds them the transcriber's settled segments.
 *
 * The box shows `text` (the settled words, editable once paused) and then
 * `partial` (the words still being heard, faint). A settled segment that ends
 * in a command acts: "send" starts the 2-second Undo, "pause" pauses,
 * "cancel" clears and stops. The command's own words never reach the text.
 */

export type DictationPhase = 'idle' | 'starting' | 'listening' | 'paused' | 'countdown' | 'problem';

/**
 * Where a message box offers Dictate. In Send's place while the box is empty;
 * beside Send when files are attached and nothing is typed, so a file and a
 * spoken prompt go in one message (Lucy's rehearsal, 27 November 2026: the
 * mic went away once a file was attached). Never while dictating or once
 * words are typed.
 */
export function dictateOffer(
  canDictate: boolean,
  dictating: boolean,
  typed: string,
  attached: number,
): 'instead' | 'beside' | null {
  if (!canDictate || dictating || typed.trim() !== '') return null;
  return attached > 0 ? 'beside' : 'instead';
}

/** How long a spoken "send" waits for Undo (Arthur's choice, 14:31Z). */
export const SEND_UNDO_MS = 2_000;

/** Two settled pieces as one text: one space between, none added after a line break. */
export function joinText(before: string, after: string): string {
  const a = before.trimEnd();
  const b = after.trim();
  if (!a) return b;
  if (!b) return a;
  return /\n$/.test(before) ? `${before}${b}` : `${a} ${b}`;
}

export interface SegmentResult {
  /** The text with the segment's words added (its command left out). */
  text: string;
  /** The command the segment ended in, if any. */
  command: DictationCommand | null;
}

/** A settled segment arrives: its words join the text; a trailing command is handed back to act on. */
export function applySegment(text: string, segment: string): SegmentResult {
  const read = readCommand(segment);
  return { text: joinText(text, read.text), command: read.command };
}

/** "0:14", "4:59": the dictation's clock beside the red dot. */
export function timerLabel(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Whether a send goes ahead: some words to send, or the countdown already ran. */
export function hasWords(text: string): boolean {
  return text.trim().length > 0;
}

/**
 * Whether a message keeps its voice: not in a confidential chat (it keeps no
 * files) or a redacted one (the voice would keep the names the text hides);
 * Backend refuses both with 422, so the page never sends the clip there.
 */
export function keepsVoice(chat: { isConfidential: boolean; isRedacted: boolean }): boolean {
  return !chat.isConfidential && !chat.isRedacted;
}

/** Why dictation did not start, in the box's words (the microphone lines are the recorder's own). */
export function dictationProblemLine(problem: StartProblem, serverMessage: string | null = null): string {
  switch (problem) {
    case 'insecure':
      return 'Dictation needs a secure connection (https).';
    case 'unsupported':
      return 'This browser can’t take dictation. Try Chrome, Edge or Safari.';
    case 'no_access':
      return 'Dictation isn’t available on your account.';
    case 'server':
      return serverMessage || 'Dictation didn’t start. Try again.';
    default:
      return startProblemLine(problem);
  }
}

/** The quiet line under the box while dictating, or null for none. */
export function dictationHint(state: { phase: DictationPhase; atLimit: boolean; liveDown: boolean }): string | null {
  if (state.atLimit) return '5 minutes is the longest. Send, or X to clear.';
  if (state.liveDown && (state.phase === 'listening' || state.phase === 'paused')) {
    return 'The live words stopped. Pause to type them.';
  }
  // No line while listening (Stay, 25 November 2026: the "say send" hint "shouldnt be there").
  if (state.phase === 'paused') return 'Paused. Edit the words, or tap the mic to go on.';
  return null;
}

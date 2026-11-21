import type { Channel } from '@/types/collab';
import type { RecordingStage, RecordingTargetInput } from '@/types/recording';

/**
 * The recorder's rules, React-free so they can be read and tested on their own
 * (thread ac47b1df; the design Stay OK'd on 20 November 2026).
 */

/** The saved audio goes up in pieces this long while recording (Stay, 20 November 2026). */
export const PIECE_MS = 30_000;

/** "12:47", or "1:02:05" past an hour. */
export function clock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

/**
 * The saved recording's format, from what this browser can record: Opus in
 * WebM on Chrome, Edge and Android; AAC in MP4 on iPhone Safari. Null when
 * the browser can record neither (the recorder then says so and offers nothing).
 */
export function pickAudioMime(isTypeSupported: (mime: string) => boolean): string | null {
  for (const mime of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) {
    if (isTypeSupported(mime)) return mime;
  }
  return null;
}

/** Why the recorder could not start, in the person's words. */
export type StartProblem = 'no_mic' | 'mic_denied' | 'mic_busy' | 'insecure' | 'unsupported' | 'no_access' | 'server';

export function startProblemLine(problem: StartProblem, serverMessage?: string | null): string {
  switch (problem) {
    case 'no_mic':
      return 'No microphone was found. Connect one, then try again.';
    case 'mic_denied':
      return 'Lawexa can’t use your microphone. Allow it in your browser’s site settings, then try again.';
    case 'mic_busy':
      return 'Another app is using your microphone. Close it, then try again.';
    case 'insecure':
      return 'Recording needs a secure connection (https).';
    case 'unsupported':
      return 'This browser can’t record audio. Try Chrome, Edge or Safari.';
    case 'no_access':
      return 'Recording isn’t available on your account.';
    case 'server':
      return serverMessage || 'The recording didn’t start. Try again.';
  }
}

/** What a getUserMedia refusal means. */
export function micProblem(error: unknown): StartProblem {
  const name = error instanceof Error || (typeof error === 'object' && error !== null) ? (error as { name?: string }).name : undefined;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'mic_denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'no_mic';
  if (name === 'NotReadableError' || name === 'AbortError') return 'mic_busy';
  return 'unsupported';
}

export type StepState = 'done' | 'now' | 'next' | 'failed';

/**
 * After Stop: the three steps the finalising card shows (the design OK'd on
 * 20 November), from the server's stage.
 */
export function finalSteps(
  stage: RecordingStage,
  durationSeconds: number,
): { label: string; state: StepState }[] {
  const order: RecordingStage[] = ['uploading', 'transcribing', 'summarising', 'done'];
  const at = order.indexOf(stage);
  const state = (index: number): StepState => {
    if (stage === 'done') return 'done';
    if (at === -1) return index === 0 ? 'now' : 'next';
    return index < at ? 'done' : index === at ? 'now' : 'next';
  };
  return [
    { label: state(0) === 'done' ? `Audio saved, ${clock(durationSeconds)}` : 'Saving the audio', state: state(0) },
    { label: state(1) === 'done' ? 'Final transcript written' : 'Writing the final transcript', state: state(1) },
    { label: state(2) === 'done' ? 'Summary and action items posted' : 'Summary and action items', state: state(2) },
  ];
}

/**
 * One line of the live transcript: a stretch of speech up to a pause. Speaker
 * labels when the server turns them on (`live.diarize`, on by default: Stay
 * chose labels on 21 November 2026). A label arrives only after its segment
 * settles, so the moving line never shows one; the saved transcript after Stop
 * names speakers again, more reliably.
 */
export interface LiveLine {
  /** Stable for a settled line; the line still being heard has id "hearing". */
  id: string;
  /** Seconds from the start of the recording. */
  at: number;
  text: string;
  /** "Speaker 1", only when the server turned live labels on (`live.diarize`) and the service gave one. */
  speaker?: string;
}

/** What a live transcriber reports, whichever service it is. */
export type LiveEvent =
  | { kind: 'partial'; text: string; at: number }
  | { kind: 'committed'; text: string; at: number }
  /** A label for a segment already settled (it arrives after the commit). */
  | { kind: 'speaker'; lineIndex: number; speaker: string };

export interface LiveTranscript {
  lines: LiveLine[];
  /** The words still being heard, drawn faint until they settle. */
  hearing: LiveLine | null;
}

export const EMPTY_TRANSCRIPT: LiveTranscript = { lines: [], hearing: null };

/**
 * Add one event to the live transcript. A partial replaces the faint line (the
 * service sends about 7 a second, each one whole); a committed segment settles
 * it as its own line, after the speaker pauses.
 */
export function applyLiveEvent(transcript: LiveTranscript, event: LiveEvent): LiveTranscript {
  if (event.kind === 'speaker') {
    const line = transcript.lines[event.lineIndex];
    if (!line || line.speaker === event.speaker) return transcript;
    const lines = transcript.lines.slice();
    lines[event.lineIndex] = { ...line, speaker: event.speaker };
    return { ...transcript, lines };
  }
  const text = event.text.trim();
  if (event.kind === 'partial') {
    return { ...transcript, hearing: text ? { id: 'hearing', at: transcript.hearing?.at ?? event.at, text } : null };
  }
  if (!text) return { ...transcript, hearing: null };
  const at = transcript.hearing?.at ?? event.at;
  return { lines: [...transcript.lines, { id: `line-${transcript.lines.length}`, at, text }], hearing: null };
}

/** The line under the recorder's transcript: the live text is rough; the saved one names speakers. */
export function liveTranscriptNote(speakerLabels: boolean): string {
  return speakerLabels ? 'Live transcript. Speakers are checked again in the final transcript.' : 'Live transcript. Speakers are named in the final transcript.';
}

/** How long to wait before sending a piece again after a failed upload: 2, 4, 8, … up to 30 seconds. */
export function retryDelayMs(attempt: number): number {
  return Math.min(30_000, 2_000 * 2 ** Math.max(0, attempt - 1));
}

/** "Saved up to 12:30": how much of the recording the server already holds. */
export function savedUpToLine(savedPieces: number): string | null {
  if (savedPieces <= 0) return null;
  return `Saved up to ${clock((savedPieces * PIECE_MS) / 1000)}`;
}

/**
 * Where a recording made in a Space channel or thread belongs. A thread is a
 * channel with a parent: the recording names the Space, the parent channel and
 * the thread, so its card and Lawexa's summary are posted in the thread.
 */
export function channelRecordingTarget(
  channel: Pick<Channel, 'uuid' | 'is_thread' | 'parent_channel_uuid' | 'space'>,
): RecordingTargetInput {
  if (channel.is_thread && channel.parent_channel_uuid) {
    return { space_uuid: channel.space.uuid, channel_uuid: channel.parent_channel_uuid, thread_uuid: channel.uuid };
  }
  return { space_uuid: channel.space.uuid, channel_uuid: channel.uuid };
}


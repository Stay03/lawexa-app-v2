import type { RecordingLiveConfig } from '@/types/recording';
import type { LiveEvent, SpeakerTurn } from './recording-model';

/**
 * ElevenLabs Scribe Live, the recorder's live transcriber (thread ac47b1df).
 * Everything specific to ElevenLabs is in this file, so another service can
 * take its place behind the same small interface (Stay, 21 November 2026:
 * provider specifics in their own clearly named module).
 *
 * The protocol, from ElevenLabs' docs and Backend's test of 21 November 2026
 * (real sessions on the test key):
 * - one WebSocket; the single-use token from POST /recordings goes in the
 *   query, with the model, the audio format, voice-activity commits, English
 *   and each keyterm as its own `keyterms` key;
 * - the page sends {message_type: "input_audio_chunk", audio_base_64, commit:
 *   false, sample_rate: 16000} with 16 kHz mono 16-bit PCM, a quarter second
 *   at a time, and silence while paused (the service closes after 15 seconds
 *   with no message);
 * - the service sends partial_transcript (about 7 a second, each whole) and
 *   committed_transcript once a speaker pauses (about 1.5 seconds), and with
 *   labels on, diarized_transcript right after it: the same segment's words,
 *   each with a speaker_id (one segment can hold several speakers);
 * - to end, an empty chunk with commit: true, then the last committed text,
 *   then close.
 */

export const LIVE_SAMPLE_RATE = 16_000;

/** The socket address for a live config. Labels are asked for only when they are shown. */
export function liveSocketUrl(config: RecordingLiveConfig, options: { speakerLabels: boolean }): string {
  const params = new URLSearchParams({
    model_id: config.model_id,
    token: config.token,
    audio_format: 'pcm_16000',
    commit_strategy: 'vad',
    include_timestamps: 'false',
    language_code: config.language_code ?? 'en',
  });
  if (options.speakerLabels) params.set('diarize', 'true');
  for (const term of config.keyterms) params.append('keyterms', term);
  return `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params.toString()}`;
}

/** The service's refusals, as its `message_type`. */
const ERROR_TYPES = new Set([
  'error',
  'auth_error',
  'quota_exceeded',
  'rate_limited',
  'session_time_limit_exceeded',
  'input_error',
  'chunk_size_exceeded',
  'invalid_request',
  'transcriber_error',
]);

export type LiveMessage =
  | { kind: 'event'; event: LiveEvent }
  | { kind: 'started' }
  /** The session ran out (its time limit or token): reconnect with a fresh token. */
  | { kind: 'expired' }
  | { kind: 'error'; message: string }
  | { kind: 'ignore' };

interface DiarizedWord {
  text?: unknown;
  type?: unknown;
  speaker_id?: unknown;
}

/** "speaker_0" → "Speaker 1"; any other id is shown as it came. */
function speakerName(id: string): string {
  const digits = id.replace(/\D/g, '');
  return digits === '' ? id : `Speaker ${Number(digits) + 1}`;
}

/**
 * A diarized segment's words grouped into runs by speaker, in order. Spaces
 * carry no speaker and join the run they sit in; a run left empty after
 * trimming is dropped.
 */
export function speakerTurns(words: DiarizedWord[]): SpeakerTurn[] {
  const runs: { id: string; text: string }[] = [];
  for (const word of words) {
    const text = typeof word.text === 'string' ? word.text : '';
    const id = word.type !== 'spacing' && typeof word.speaker_id === 'string' ? word.speaker_id : null;
    const last = runs.at(-1);
    if (last && (id === null || id === last.id)) last.text += text;
    else if (id !== null) runs.push({ id, text });
  }
  return runs
    .map((run) => ({ speaker: speakerName(run.id), text: run.text.trim() }))
    .filter((turn) => turn.text !== '');
}

/**
 * One message from the service. `at` is the recording's own clock in seconds
 * when the message arrived; `committedCount` numbers the next settled line, so
 * a speaker label (which arrives after its commit) finds its line.
 */
export function parseLiveMessage(raw: string, at: number, committedCount: number): LiveMessage {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { kind: 'ignore' };
  }
  const type = typeof data.message_type === 'string' ? data.message_type : '';
  const text = typeof data.text === 'string' ? data.text : '';
  switch (type) {
    case 'session_started':
      return { kind: 'started' };
    case 'partial_transcript':
      return { kind: 'event', event: { kind: 'partial', text, at } };
    case 'committed_transcript':
      return { kind: 'event', event: { kind: 'committed', text, at } };
    case 'diarized_transcript': {
      const turns = speakerTurns(Array.isArray(data.words) ? (data.words as DiarizedWord[]) : []);
      if (turns.length === 0) return { kind: 'ignore' };
      return { kind: 'event', event: { kind: 'speakers', lineIndex: committedCount - 1, turns } };
    }
    case 'session_time_limit_exceeded':
      return { kind: 'expired' };
    default:
      if (ERROR_TYPES.has(type)) {
        return { kind: 'error', message: typeof data.error === 'string' ? data.error : type };
      }
      return { kind: 'ignore' };
  }
}

/** A quarter second of PCM as the service's audio message. */
export function audioMessage(pcm: ArrayBuffer, commit = false): string {
  const bytes = new Uint8Array(pcm);
  let binary = '';
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  }
  return JSON.stringify({ message_type: 'input_audio_chunk', audio_base_64: btoa(binary), commit, sample_rate: LIVE_SAMPLE_RATE });
}

export interface LiveTranscriberHandlers {
  onMessage: (message: LiveMessage) => void;
  /** The socket closed without finish(): reconnect with a fresh token. */
  onDropped: () => void;
}

/** The most audio a session keeps while its socket opens: 10 seconds of quarter-second pieces. */
export const LIVE_QUEUE_MAX = 40;

/** One live session: open, send audio, finish. A fresh one replaces it after a drop. */
export class ElevenLabsLiveSession {
  private socket: WebSocket | null = null;
  private finishing = false;
  /** Audio heard before the socket opened, oldest first; sent the moment it opens. */
  private queue: ArrayBuffer[] = [];
  private readonly handlers: LiveTranscriberHandlers;
  private readonly clock: () => number;
  private committed: () => number;

  constructor(handlers: LiveTranscriberHandlers, clock: () => number, committed: () => number) {
    this.handlers = handlers;
    this.clock = clock;
    this.committed = committed;
  }

  open(config: RecordingLiveConfig, speakerLabels: boolean): void {
    const socket = new WebSocket(liveSocketUrl(config, { speakerLabels }));
    socket.onopen = () => {
      if (this.socket !== socket) return;
      for (const pcm of this.queue) socket.send(audioMessage(pcm));
      this.queue = [];
    };
    socket.onmessage = (message) => {
      if (typeof message.data !== 'string') return;
      this.handlers.onMessage(parseLiveMessage(message.data, this.clock(), this.committed()));
    };
    socket.onclose = () => {
      if (this.socket === socket && !this.finishing) this.handlers.onDropped();
      if (this.socket === socket) this.socket = null;
    };
    this.socket = socket;
  }

  /**
   * Send a quarter second of audio. While the socket is still opening it waits
   * in order and goes first once it opens, so the first words spoken after the
   * tap reach the transcriber (Lucy's rehearsal, 27 November 2026: "Lawexa,
   * file…" arrived as "File…"). Kept to {@link LIVE_QUEUE_MAX}, oldest first out.
   */
  send(pcm: ArrayBuffer): void {
    const socket = this.socket;
    if (socket?.readyState === WebSocket.OPEN) socket.send(audioMessage(pcm));
    else if (!socket || socket.readyState === WebSocket.CONNECTING) {
      this.queue.push(pcm);
      if (this.queue.length > LIVE_QUEUE_MAX) this.queue.shift();
    }
  }

  /** End the session: commit what was heard, let the last text arrive, then close. */
  finish(): void {
    const socket = this.socket;
    if (!socket) return;
    this.finishing = true;
    if (socket.readyState === WebSocket.OPEN) socket.send(audioMessage(new ArrayBuffer(0), true));
    setTimeout(() => socket.close(), 2_000);
  }

  /** Close at once (the page is leaving). */
  close(): void {
    this.finishing = true;
    this.queue = [];
    this.socket?.close();
    this.socket = null;
  }
}

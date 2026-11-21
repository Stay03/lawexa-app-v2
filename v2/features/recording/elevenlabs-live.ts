import type { RecordingLiveConfig } from '@/types/recording';
import type { LiveEvent } from './recording-model';

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
 *   committed_transcript once a speaker pauses (about 1.5 seconds);
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
      const words = Array.isArray(data.words) ? (data.words as { speaker_id?: unknown; type?: unknown }[]) : [];
      const id = words.find((word) => word.type !== 'spacing' && typeof word.speaker_id === 'string')?.speaker_id;
      if (typeof id !== 'string') return { kind: 'ignore' };
      const number = Number(id.replace(/\D/g, ''));
      const speaker = Number.isFinite(number) ? `Speaker ${number + 1}` : id;
      return { kind: 'event', event: { kind: 'speaker', lineIndex: committedCount - 1, speaker } };
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

/** One live session: open, send audio, finish. A fresh one replaces it after a drop. */
export class ElevenLabsLiveSession {
  private socket: WebSocket | null = null;
  private finishing = false;
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

  /** Send a quarter second of audio; dropped while the socket is not open (the saved audio still has it). */
  send(pcm: ArrayBuffer): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(audioMessage(pcm));
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
    this.socket?.close();
    this.socket = null;
  }
}

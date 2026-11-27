import { dictationApi } from '@/lib/api/dictation';
import { extractApiError } from '@/lib/utils/api-error';
import type { RecordingLiveConfig } from '@/types/recording';
import { DICTATION_MAX_MS } from '@/types/dictation';
import { ElevenLabsLiveSession, LIVE_QUEUE_MAX } from '../recording/elevenlabs-live';
import { micProblem, pickAudioMime, type StartProblem } from '../recording/recording-model';
import { applySegment, hasWords, SEND_UNDO_MS, type DictationPhase } from './dictation-model';
import { playEndBeep, playStartBeep } from './dictation-sounds';

/**
 * One dictation in the message box (Arthur, 25 November 2026, design A2,
 * staff first). An external store, so the box reads it with
 * useSyncExternalStore and no effect sets state.
 *
 * From the one microphone, as the meeting recorder does:
 * - the live words: an AudioWorklet turns the microphone into 16 kHz PCM for
 *   the live transcriber, opened with a single-use token from
 *   POST /dictation/live-token. Settled segments join the text; one that ends
 *   in a spoken command acts (dictation-model, commands);
 * - the voice: MediaRecorder keeps the whole clip in memory, and it goes up
 *   once, at send, when the chat keeps voices.
 *
 * One click starts listening (start beep). Pause keeps the words and lets the
 * person edit them; Send (or a spoken "send" after its 2-second Undo) ends
 * listening (end beep) and hands the words and the clip to the box. X cancels
 * and clears. At 5 minutes, the longest clip kept, listening pauses.
 */

export interface DictationState {
  phase: DictationPhase;
  /** The settled words, editable while paused. */
  text: string;
  /** The words still being heard, drawn faint after the text. */
  partial: string;
  /** Milliseconds heard, pauses left out. */
  elapsedMs: number;
  /** The last few loudness readings, 0 to 1, oldest first, for the sound bar. */
  levels: number[];
  /** While a spoken "send" waits for Undo: the whole seconds left (2, then 1). */
  sendIn: number | null;
  /** Listening paused itself at the 5-minute limit. */
  atLimit: boolean;
  /** The live words stopped (no token, or the service refused); the voice is still kept. */
  liveDown: boolean;
  problem: { kind: StartProblem; message: string | null } | null;
}

/** What a finished dictation hands the box: its words, and its voice when kept. */
export interface DictationResult {
  text: string;
  clip: Blob | null;
  durationMs: number;
}

/** What the box does with a dictation's end. */
export interface DictationHandlers {
  /** Listening ended with Send: the words (and the voice) go. */
  onSend: (result: DictationResult) => void;
  /** Listening did not start: the sentence to show. */
  onProblem: (kind: StartProblem, serverMessage: string | null) => void;
}

const IDLE: DictationState = {
  phase: 'idle',
  text: '',
  partial: '',
  elapsedMs: 0,
  levels: [],
  sendIn: null,
  atLimit: false,
  liveDown: false,
  problem: null,
};

/** How many loudness readings the sound bar draws. */
const LEVEL_HISTORY = 48;

export class DictationController {
  private state: DictationState = IDLE;
  private readonly listeners = new Set<() => void>();
  private handlers: DictationHandlers | null = null;

  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private pieces: Blob[] = [];
  private audio: AudioContext | null = null;
  private worklet: AudioWorkletNode | null = null;
  private live: ElevenLabsLiveSession | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private countdown: ReturnType<typeof setTimeout> | null = null;
  private sendAt = 0;
  private startedAt = 0;
  private pausedTotal = 0;
  private pausedAt = 0;
  private committedCount = 0;
  /** Audio taken before the first live session existed (the token was on its way). */
  private early: ArrayBuffer[] = [];

  /** The box's latest handlers, set after each render (never during one). */
  connect = (handlers: DictationHandlers) => {
    this.handlers = handlers;
  };

  // ── The store ──────────────────────────────────────────────────────────
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private set(next: Partial<DictationState>) {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }

  // ── What the person does ───────────────────────────────────────────────
  /**
   * One click: the microphone, the voice and the live words. The token is
   * asked for at the tap, beside the microphone, so a refusal (no access, the
   * day's allowance used up) shows before any beep. Audio is taken from the
   * moment the microphone opens; the start beep and the listening state come
   * once that and the token are ready, so the beep means "speak now". The live
   * socket then opens while the person speaks, and what they said in the
   * meantime goes first (elevenlabs-live), so no first word is lost (Lucy's
   * rehearsal, 27 November 2026: "Lawexa, file…" arrived as "File…").
   */
  start = async () => {
    if (this.state.phase !== 'idle' && this.state.phase !== 'problem') return;
    this.set({ ...IDLE, phase: 'starting' });
    if (typeof window === 'undefined' || !window.isSecureContext) return this.fail('insecure');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return this.fail('unsupported');
    const mime = pickAudioMime((type) => MediaRecorder.isTypeSupported(type));
    if (!mime) return this.fail('unsupported');
    const token = dictationApi.liveToken().then((answer) => {
      if (!answer.data) throw new Error(answer.message);
      return answer.data.live;
    });
    // Read below, after the microphone; this only keeps an early refusal from going unhandled.
    token.catch(() => {});
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch (error) {
      return this.fail(micProblem(error));
    }
    if (this.startCalledOff()) return this.releaseMedia();

    this.pieces = [];
    this.recorder = new MediaRecorder(this.stream, { mimeType: mime });
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.pieces.push(event.data);
    };
    this.recorder.start(1_000);
    this.startedAt = performance.now();
    this.pausedTotal = 0;
    this.committedCount = 0;
    await this.startCapture();

    let live: RecordingLiveConfig;
    try {
      live = await token;
    } catch (error) {
      if (this.startCalledOff()) return;
      void this.stopRecorder();
      const { status, message } = extractApiError(error);
      return this.fail(status === 403 ? 'no_access' : 'server', message);
    }
    if (this.startCalledOff()) return;
    this.ticker = setInterval(() => this.tick(), 250);
    playStartBeep();
    this.set({ phase: 'listening', elapsedMs: 0 });
    if (!this.state.liveDown) this.openLive(live);
  };

  /** The person cancelled (or the box went away) while the start was on its way. */
  private startCalledOff(): boolean {
    return this.state.phase !== 'starting';
  }

  /** Pause (also from the Undo wait: the spoken send is called off). */
  pause = () => {
    if (this.state.phase === 'countdown') this.clearCountdown();
    else if (this.state.phase !== 'listening') return;
    this.recorder?.pause();
    this.worklet?.port.postMessage({ paused: true });
    this.pausedAt = performance.now();
    this.set({ phase: 'paused', partial: '' });
  };

  resume = () => {
    if (this.state.phase !== 'paused' || this.state.atLimit) return;
    this.recorder?.resume();
    this.worklet?.port.postMessage({ paused: false });
    this.pausedTotal += performance.now() - this.pausedAt;
    this.set({ phase: 'listening' });
  };

  /** The person edited the words while paused. */
  setText = (text: string) => {
    if (this.state.phase === 'paused') this.set({ text });
  };

  /** Send: listening ends now (the button, or a spoken "send" once its Undo ran out). */
  send = async () => {
    const phase = this.state.phase;
    if (phase !== 'listening' && phase !== 'paused' && phase !== 'countdown') return;
    this.clearCountdown();
    const text = joinPartial(this.state.text, this.state.partial);
    if (!hasWords(text)) return;
    const durationMs = this.heardMs();
    this.live?.finish();
    const clip = await this.stopRecorder();
    this.releaseMedia();
    playEndBeep();
    this.set(IDLE);
    this.handlers?.onSend({ text, clip, durationMs });
  };

  /** Undo a spoken "send": listening goes on, the words stay. */
  undo = () => {
    if (this.state.phase !== 'countdown') return;
    this.clearCountdown();
    this.set({ phase: 'listening' });
  };

  /** X: listening stops and the words go (nothing is sent). */
  cancel = async () => {
    if (this.state.phase === 'idle') return;
    this.clearCountdown();
    this.live?.close();
    await this.stopRecorder();
    this.releaseMedia();
    if (this.state.phase !== 'problem') playEndBeep();
    this.set(IDLE);
  };

  /** The box is going away: the microphone closes and the words go. */
  dispose = () => {
    if (this.state.phase === 'idle') return;
    this.clearCountdown();
    this.live?.close();
    void this.stopRecorder();
    this.releaseMedia();
    this.set(IDLE);
  };

  // ── Inside ─────────────────────────────────────────────────────────────
  private fail(kind: StartProblem, message: string | null = null) {
    this.releaseMedia();
    this.set({ ...IDLE, phase: 'problem', problem: { kind, message } });
    this.handlers?.onProblem(kind, message);
  }

  private heardMs(): number {
    if (!this.startedAt) return 0;
    const pausedNow = this.state.phase === 'paused' ? performance.now() - this.pausedAt : 0;
    return Math.max(0, performance.now() - this.startedAt - this.pausedTotal - pausedNow);
  }

  private tick() {
    const elapsedMs = this.heardMs();
    if (this.state.phase === 'countdown') {
      this.set({ elapsedMs, sendIn: Math.max(1, Math.ceil((this.sendAt - performance.now()) / 1000)) });
      return;
    }
    if (elapsedMs >= DICTATION_MAX_MS && this.state.phase === 'listening') {
      this.pause();
      this.set({ atLimit: true, elapsedMs: DICTATION_MAX_MS });
      return;
    }
    this.set({ elapsedMs });
  }

  /** The microphone as 16 kHz PCM, kept in {@link early} until the live session exists. */
  private async startCapture() {
    if (!this.stream) return;
    this.early = [];
    try {
      this.audio = new AudioContext();
      await this.audio.audioWorklet.addModule('/recording/pcm-worklet.js');
      this.worklet = new AudioWorkletNode(this.audio, 'lawexa-pcm');
      this.worklet.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => {
        if (this.live) this.live.send(event.data.pcm);
        else {
          this.early.push(event.data.pcm);
          if (this.early.length > LIVE_QUEUE_MAX) this.early.shift();
        }
        const level = this.state.phase === 'listening' || this.state.phase === 'countdown' ? Math.min(1, event.data.level * 4) : 0;
        this.set({ levels: [...this.state.levels, level].slice(-LEVEL_HISTORY) });
      };
      this.audio.createMediaStreamSource(this.stream).connect(this.worklet);
    } catch {
      // No live words on this browser: the voice is still kept, and the words can be typed.
      this.set({ liveDown: true });
    }
  }

  private openLive(config: RecordingLiveConfig) {
    this.live?.close();
    const session = new ElevenLabsLiveSession(
      {
        onMessage: (message) => {
          if (message.kind === 'event') this.onLiveEvent(message.event);
          else if (message.kind === 'expired') void this.reconnectLive();
          else if (message.kind === 'error') this.set({ liveDown: true });
        },
        onDropped: () => void this.reconnectLive(),
      },
      () => this.heardMs() / 1000,
      () => this.committedCount,
    );
    session.open(config, false);
    // What was said before the token came goes first, then the audio as it comes.
    for (const pcm of this.early) session.send(pcm);
    this.early = [];
    this.live = session;
  }

  private onLiveEvent(event: { kind: string; text?: string }) {
    if (event.kind === 'partial' && this.state.phase === 'listening') {
      this.set({ partial: event.text ?? '', liveDown: false });
      return;
    }
    if (event.kind !== 'committed') return;
    this.committedCount += 1;
    // A segment that settles after a pause or a send still joins the words it belongs to.
    const { text, command } = applySegment(this.state.text, event.text ?? '');
    this.set({ text, partial: '', liveDown: false });
    if (this.state.phase !== 'listening') return;
    if (command === 'send' && hasWords(text)) this.startCountdown();
    else if (command === 'pause') this.pause();
    else if (command === 'cancel') void this.cancel();
  }

  private startCountdown() {
    this.clearCountdown();
    this.sendAt = performance.now() + SEND_UNDO_MS;
    this.set({ phase: 'countdown', sendIn: Math.ceil(SEND_UNDO_MS / 1000) });
    this.countdown = setTimeout(() => void this.send(), SEND_UNDO_MS);
  }

  private clearCountdown() {
    if (this.countdown) clearTimeout(this.countdown);
    this.countdown = null;
    if (this.state.sendIn !== null) this.set({ sendIn: null });
  }

  /** A fresh single-use token for a long dictation. */
  private async reconnectLive() {
    if (this.state.phase !== 'listening' && this.state.phase !== 'paused') return;
    try {
      const answer = await dictationApi.liveToken();
      if (answer.data && (this.state.phase === 'listening' || this.state.phase === 'paused')) this.openLive(answer.data.live);
    } catch {
      this.set({ liveDown: true });
    }
  }

  /** Stop the voice and hand back the clip (null when nothing was heard). */
  private stopRecorder(): Promise<Blob | null> {
    const recorder = this.recorder;
    this.recorder = null;
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(this.clip(recorder?.mimeType));
    return new Promise((resolve) => {
      recorder.onstop = () => resolve(this.clip(recorder.mimeType));
      recorder.stop();
    });
  }

  private clip(mime: string | undefined): Blob | null {
    const pieces = this.pieces;
    this.pieces = [];
    return pieces.length > 0 ? new Blob(pieces, { type: mime || pieces[0].type }) : null;
  }

  private releaseMedia() {
    this.early = [];
    this.live = null;
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    this.worklet?.disconnect();
    this.worklet = null;
    void this.audio?.close().catch(() => {});
    this.audio = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
  }
}

/** The words to send: the settled text and any words still being heard. */
function joinPartial(text: string, partial: string): string {
  const tail = partial.trim();
  return tail ? `${text.trimEnd()}${text.trim() ? ' ' : ''}${tail}` : text.trim();
}

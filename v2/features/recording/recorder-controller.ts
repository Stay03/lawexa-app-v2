import { recordingsApi } from '@/lib/api/recordings';
import { extractApiError } from '@/lib/utils/api-error';
import type { RecordingLiveConfig, RecordingStage, RecordingTargetInput } from '@/types/recording';
import { ElevenLabsLiveSession } from './elevenlabs-live';
import { onRecordingUpdated } from './recording-events';
import { PieceQueue } from './piece-queue';
import {
  applyLiveEvent,
  EMPTY_TRANSCRIPT,
  micProblem,
  PIECE_MS,
  pickAudioMime,
  type LiveTranscript,
  type StartProblem,
} from './recording-model';

/**
 * One recording, from the consent screen to the posted card (thread ac47b1df;
 * the design Stay OK'd on 20 November 2026; Backend's shapes of 21 November).
 * An external store, so the screen reads it with useSyncExternalStore and no
 * effect sets state.
 *
 * Two things run from the one microphone while recording:
 * - the saved audio: MediaRecorder hands over a piece every 30 seconds and the
 *   PieceQueue uploads it at once, so a closed tab loses at most one piece;
 * - the live text: an AudioWorklet turns the microphone into 16 kHz PCM, sent
 *   straight to the live transcriber with the single-use token. Our server
 *   carries no live audio. A dropped socket reconnects with a fresh token; the
 *   saved audio never depends on it.
 */

export type RecorderPhase = 'idle' | 'consent' | 'starting' | 'live' | 'stopping' | 'finalising' | 'problem';

export interface RecorderState {
  phase: RecorderPhase;
  paused: boolean;
  /** Seconds recorded, pauses left out. */
  elapsed: number;
  /** The microphone's loudness, 0 to 1, a few times a second. */
  level: number;
  /** The last few loudness readings, oldest first, for the sound bar. */
  levels: number[];
  transcript: LiveTranscript;
  /** Pieces of the saved audio the server holds, from the start without a gap. */
  savedPieces: number;
  /** The live text stopped (no token, or the service refused); the recording goes on. */
  liveDown: boolean;
  /** The server turned live speaker labels on for this recording (`live.diarize`). */
  speakerLabels: boolean;
  problem: { kind: StartProblem; message: string | null } | null;
  recordingUuid: string | null;
  /** After Stop: the server's stage, and its sentence if a step failed. */
  stage: RecordingStage | null;
  stageError: string | null;
  /**
   * The server closed the recording before Stop: nothing reached it for 10
   * minutes (a tab or phone asleep), so it finished what it had.
   */
  closedByServer: boolean;
}

const IDLE: RecorderState = {
  phase: 'idle',
  paused: false,
  elapsed: 0,
  level: 0,
  levels: [],
  transcript: EMPTY_TRANSCRIPT,
  savedPieces: 0,
  liveDown: false,
  speakerLabels: false,
  problem: null,
  recordingUuid: null,
  stage: null,
  stageError: null,
  closedByServer: false,
};

/** 409 recording_stopped: the server closed the recording itself. */
function isRecordingStopped(error: unknown): boolean {
  const { status, errors } = extractApiError(error);
  return status === 409 && (errors as { reason?: unknown } | null)?.reason === 'recording_stopped';
}

const POLL_MS = 4_000;
/**
 * How often an open recording tells the server it is still there, paused or
 * not (Backend, 21 November 2026). A pause sends no pieces, and the server
 * closes a recording that hears nothing for 10 minutes: a court recess would
 * otherwise lose its second half.
 */
const KEEPALIVE_MS = 60_000;
/** How many loudness readings the sound bar draws (its widest, on a phone). */
const LEVEL_HISTORY = 36;
const RECONNECT_GAP_MS = 5_000;

export class RecorderController {
  private state: RecorderState = IDLE;
  private readonly listeners = new Set<() => void>();
  private readonly target: RecordingTargetInput;

  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private audio: AudioContext | null = null;
  private worklet: AudioWorkletNode | null = null;
  private live: ElevenLabsLiveSession | null = null;
  private queue: PieceQueue | null = null;
  private wakeLock: { release: () => Promise<void> } | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private keepalive: ReturnType<typeof setInterval> | null = null;
  private poller: ReturnType<typeof setInterval> | null = null;
  private stopListening: (() => void) | null = null;

  /** performance.now() when recording started, and the pause time so far. */
  private startedAt = 0;
  private pausedTotal = 0;
  private pausedAt = 0;
  private lastReconnect = 0;

  constructor(target: RecordingTargetInput) {
    this.target = target;
  }

  // ── The store ──────────────────────────────────────────────────────────
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private set(next: Partial<RecorderState>) {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }

  // ── What the person does ───────────────────────────────────────────────
  /** The microphone was tapped: the consent screen. */
  ask = () => {
    if (this.state.phase === 'idle' || this.state.phase === 'problem') this.set({ ...IDLE, phase: 'consent' });
  };

  cancel = () => {
    if (this.state.phase === 'consent' || this.state.phase === 'problem') this.set(IDLE);
  };

  /** Start recording: the microphone, the recording on the server, the saved audio and the live text. */
  start = async () => {
    if (this.state.phase !== 'consent') return;
    this.set({ phase: 'starting' });
    if (typeof window === 'undefined' || !window.isSecureContext) return this.fail('insecure');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return this.fail('unsupported');
    const mime = pickAudioMime((type) => MediaRecorder.isTypeSupported(type));
    if (!mime) return this.fail('unsupported');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch (error) {
      return this.fail(micProblem(error));
    }

    let live: RecordingLiveConfig;
    try {
      const answer = await recordingsApi.create(this.target, mime);
      if (!answer.data) throw new Error(answer.message);
      this.set({ recordingUuid: answer.data.uuid });
      live = answer.data.live;
    } catch (error) {
      const { status, message, errors } = extractApiError(error);
      // 403 no_access: this account may not record (can_record off); anything else says the server's sentence.
      const reason = (errors as { reason?: unknown } | null)?.reason;
      return this.fail(status === 403 && reason === 'no_access' ? 'no_access' : 'server', message);
    }

    const uuid = this.state.recordingUuid as string;
    this.queue = new PieceQueue(
      async (seq, piece) => {
        try {
          await recordingsApi.uploadChunk(uuid, seq, piece);
        } catch (error) {
          if (isRecordingStopped(error)) void this.closedByServer();
          throw error;
        }
      },
      (savedPieces) => this.set({ savedPieces }),
    );
    this.recorder = new MediaRecorder(this.stream, { mimeType: mime });
    this.recorder.ondataavailable = (event) => this.queue?.push(event.data);
    this.recorder.start(PIECE_MS);
    this.startedAt = performance.now();
    this.pausedTotal = 0;

    await this.startLiveAudio(live);
    this.ticker = setInterval(() => this.set({ elapsed: this.recordedSeconds() }), 500);
    this.keepalive = setInterval(() => void this.sendKeepalive(), KEEPALIVE_MS);
    void this.holdScreen();
    window.addEventListener('beforeunload', this.warnBeforeLeaving);
    this.set({ phase: 'live', elapsed: 0 });
  };

  pause = () => {
    if (this.state.phase !== 'live' || this.state.paused) return;
    this.recorder?.pause();
    this.worklet?.port.postMessage({ paused: true });
    this.pausedAt = performance.now();
    this.set({ paused: true, level: 0 });
  };

  resume = () => {
    if (this.state.phase !== 'live' || !this.state.paused) return;
    this.recorder?.resume();
    this.worklet?.port.postMessage({ paused: false });
    this.pausedTotal += performance.now() - this.pausedAt;
    this.set({ paused: false });
  };

  /** Stop: the last piece, every piece up, then the server's final transcript and summary. */
  stop = async () => {
    if (this.state.phase !== 'live') return;
    if (this.state.paused) this.resume();
    const duration = this.recordedSeconds();
    this.set({ phase: 'stopping', elapsed: duration, level: 0 });
    this.live?.finish();
    await this.stopRecorder();
    this.releaseMedia();
    const uuid = this.state.recordingUuid;
    const queue = this.queue;
    if (!uuid || !queue) return;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await queue.drain();
      try {
        const answer = await recordingsApi.stop(uuid, {
          last_seq: queue.count - 1,
          duration_seconds: Math.round(duration),
          paused_seconds: Math.round(this.pausedTotal / 1000),
        });
        window.removeEventListener('beforeunload', this.warnBeforeLeaving);
        this.set({ phase: 'finalising', stage: answer.data?.stage ?? 'uploading' });
        this.pollStage(uuid);
        return;
      } catch (error) {
        const { status, errors } = extractApiError(error);
        const missing = (errors as { missing?: number[] } | null)?.missing;
        if (status === 409 && Array.isArray(missing) && missing.length > 0) {
          queue.resend(missing);
          continue;
        }
        this.set({ phase: 'finalising', stage: 'failed', stageError: extractApiError(error).message || 'The recording was saved, but finishing it failed. Try again.' });
        return;
      }
    }
  };

  /** Run the failed step again (the audio is never lost on a failure). */
  retry = async () => {
    const uuid = this.state.recordingUuid;
    if (!uuid || this.state.stage !== 'failed') return;
    try {
      const answer = await recordingsApi.retry(uuid);
      this.set({ stage: answer.data?.stage ?? 'uploading', stageError: null });
      this.pollStage(uuid);
    } catch (error) {
      this.set({ stageError: extractApiError(error).message || 'It failed again. Try again later.' });
    }
  };

  /** Close the finalising card; the recording's card arrives in the chat by itself. */
  close = () => {
    if (this.state.phase !== 'finalising') return;
    this.stopPolling();
    this.set(IDLE);
  };

  /** The screen is going away for good. */
  dispose = () => {
    this.live?.close();
    this.queue?.abandon();
    void this.stopRecorder();
    this.releaseMedia();
    this.stopPolling();
    if (typeof window !== 'undefined') window.removeEventListener('beforeunload', this.warnBeforeLeaving);
  };

  // ── Inside ─────────────────────────────────────────────────────────────
  private fail(kind: StartProblem, message: string | null = null) {
    this.releaseMedia();
    this.set({ phase: 'problem', problem: { kind, message } });
  }

  private recordedSeconds(): number {
    if (!this.startedAt) return 0;
    const pausedNow = this.state.paused ? performance.now() - this.pausedAt : 0;
    return Math.max(0, (performance.now() - this.startedAt - this.pausedTotal - pausedNow) / 1000);
  }

  private async startLiveAudio(config: RecordingLiveConfig) {
    if (!this.stream) return;
    try {
      this.audio = new AudioContext();
      await this.audio.audioWorklet.addModule('/recording/pcm-worklet.js');
      this.worklet = new AudioWorkletNode(this.audio, 'lawexa-pcm');
      this.worklet.port.onmessage = (event: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => {
        this.live?.send(event.data.pcm);
        const level = this.state.paused ? 0 : Math.min(1, event.data.level * 4);
        this.set({ level, levels: [...this.state.levels, level].slice(-LEVEL_HISTORY) });
      };
      this.audio.createMediaStreamSource(this.stream).connect(this.worklet);
      this.openLive(config);
    } catch {
      // No live text on this browser: the recording and its final transcript still go ahead.
      this.set({ liveDown: true });
    }
  }

  private openLive(config: RecordingLiveConfig) {
    this.live?.close();
    this.live = new ElevenLabsLiveSession(
      {
        onMessage: (message) => {
          if (message.kind === 'event') this.set({ transcript: applyLiveEvent(this.state.transcript, message.event), liveDown: false });
          else if (message.kind === 'expired') void this.reconnectLive();
          else if (message.kind === 'error') this.set({ liveDown: true });
        },
        onDropped: () => void this.reconnectLive(),
      },
      () => this.recordedSeconds(),
      () => this.state.transcript.lines.length,
    );
    this.set({ speakerLabels: config.diarize === true });
    this.live.open(config, config.diarize === true);
  }

  /** A fresh single-use token and a new socket, at most once every 5 seconds. */
  private async reconnectLive() {
    const uuid = this.state.recordingUuid;
    if (!uuid || this.state.phase !== 'live') return;
    const now = performance.now();
    if (now - this.lastReconnect < RECONNECT_GAP_MS) {
      this.set({ liveDown: true });
      return;
    }
    this.lastReconnect = now;
    try {
      const answer = await recordingsApi.liveToken(uuid);
      if (answer.data && this.state.phase === 'live') this.openLive(answer.data.live);
    } catch {
      this.set({ liveDown: true });
    }
  }

  private stopRecorder(): Promise<void> {
    const recorder = this.recorder;
    this.recorder = null;
    if (!recorder || recorder.state === 'inactive') return Promise.resolve();
    return new Promise((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
  }

  /** "Still here", paused or not. A missed one is harmless: the next comes in a minute. */
  private async sendKeepalive() {
    const uuid = this.state.recordingUuid;
    if (!uuid || this.state.phase !== 'live') return;
    try {
      await recordingsApi.keepalive(uuid, this.state.paused);
    } catch (error) {
      if (isRecordingStopped(error)) await this.closedByServer();
    }
  }

  /**
   * The server already closed this recording (409 recording_stopped on a
   * keepalive or a piece): stop recording here and follow the server as it
   * finishes what it has.
   */
  private async closedByServer() {
    if (this.state.phase !== 'live') return;
    const uuid = this.state.recordingUuid;
    this.set({ phase: 'stopping', elapsed: this.recordedSeconds(), level: 0 });
    this.live?.close();
    this.queue?.abandon();
    await this.stopRecorder();
    this.releaseMedia();
    window.removeEventListener('beforeunload', this.warnBeforeLeaving);
    this.set({ phase: 'finalising', stage: 'transcribing', closedByServer: true });
    if (uuid) this.pollStage(uuid);
  }

  private releaseMedia() {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    if (this.keepalive) clearInterval(this.keepalive);
    this.keepalive = null;
    this.worklet?.disconnect();
    this.worklet = null;
    void this.audio?.close().catch(() => {});
    this.audio = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    void this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
  }

  /** Keep a phone's screen on while recording (a locked iPhone stops the microphone). */
  private async holdScreen() {
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    try {
      this.wakeLock = (await wakeLock?.request('screen')) ?? null;
    } catch {
      this.wakeLock = null;
    }
  }

  private warnBeforeLeaving = (event: BeforeUnloadEvent) => {
    event.preventDefault();
  };

  /** The server's stage after Stop, until it is done or failed. */
  private pollStage(uuid: string) {
    this.stopPolling();
    this.stopListening = onRecordingUpdated((event) => this.noteStage(event.uuid, event.stage, event.error));
    this.poller = setInterval(async () => {
      try {
        const answer = await recordingsApi.get(uuid);
        if (!answer.data) return;
        this.set({ stage: answer.data.stage, stageError: answer.data.error });
        if (answer.data.stage === 'done' || answer.data.stage === 'failed') this.stopPolling();
      } catch {
        // A missed read: the next one tries again.
      }
    }, POLL_MS);
  }

  private stopPolling() {
    if (this.poller) clearInterval(this.poller);
    this.poller = null;
    this.stopListening?.();
    this.stopListening = null;
  }

  /** The `.recording.updated` broadcast moves the stage at once (the poll is the fallback). */
  noteStage(uuid: string, stage: RecordingStage, error: string | null) {
    if (uuid !== this.state.recordingUuid || this.state.phase !== 'finalising') return;
    this.set({ stage, stageError: error });
    if (stage === 'done' || stage === 'failed') this.stopPolling();
  }
}

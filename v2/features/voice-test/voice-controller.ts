import { voiceTestApi } from '@/lib/api/voice-test';
import { extractApiError } from '@/lib/utils/api-error';
import type { IBlockedReason } from '@/types/message-pack';
import type { VoiceCallSaved, VoiceOption, VoiceResearchReadyEvent, VoiceServerTurn, VoiceTestMode, VoiceTestSession } from '@/types/voice-test';
import { ElevenLabsVoiceSession } from './elevenlabs-voice-session';
import { onVoiceResearchReady } from './voice-events';
import { applyCallEvent, CALLER_SPEECH_SCORE, EMPTY_CALL_LOG, exhaustedBlock, mayPassResultIn, type CallEvent, type CallLog, type HandOff } from './voice-model';
import type { VoiceSession } from './voice-session';

/**
 * One voice test call at a time, from Call to the delay table (thread
 * ac47b1df; Backend fe2736bd). An external store, read with
 * useSyncExternalStore, so no effect sets state.
 */

export type VoicePhase = 'idle' | 'starting' | 'live' | 'ending' | 'ended' | 'problem';

export interface VoiceTestState {
  phase: VoicePhase;
  mode: VoiceTestMode;
  voiceId: string;
  voices: VoiceOption[];
  muted: boolean;
  /** Seconds since the call connected. */
  elapsed: number;
  log: CallLog;
  /** The server's timings for a `c` call, read after each answer and at the end. */
  serverTurns: VoiceServerTurn[];
  sessionUuid: string | null;
  /** A sentence when the call could not start or failed. */
  problem: string | null;
  /** Out of messages at Call: typed chat's own block, for the shared notice. */
  blocked: IBlockedReason | null;
  /** The call as a chat; a `b` call's arrives 15 to 30 seconds after it ends. */
  conversationUuid: string | null;
  /** Waiting for a `b` call's chat to be saved. */
  saving: boolean;
  /** Three minutes passed without the chat's id: it is still saved (Backend's job and webhook keep going), just later. */
  savingLate: boolean;
  /** Some questions in the call went unpaid: the notice shows after the call. */
  outOfMessages: boolean;
}

/**
 * The two voices before the first call answers with its own list (Backend,
 * 21 November 2026). The session's `voices` replaces this as soon as a call
 * starts, so a voice added on the server shows from the next call.
 */
export const DEFAULT_VOICES: VoiceOption[] = [
  { id: 'vinKo2zeIXmMFqY4Um07', name: 'Temitope' },
  { id: '3W7TIElBzp1JQ8BxQuXK', name: 'Chinedu' },
];

const INITIAL: VoiceTestState = {
  phase: 'idle',
  // Lawexa voice is the default (Stay, 22 November 2026); the other two stay for comparison.
  mode: 'a',
  voiceId: DEFAULT_VOICES[0].id,
  voices: DEFAULT_VOICES,
  muted: false,
  elapsed: 0,
  log: EMPTY_CALL_LOG,
  serverTurns: [],
  sessionUuid: null,
  problem: null,
  blocked: null,
  conversationUuid: null,
  saving: false,
  savingLate: false,
  outOfMessages: false,
};

/** How often, and for how long, the page asks whether a `b` call's chat is saved (Backend: usually 15 to 30 s). */
const SAVE_POLL_MS = 5000;
const SAVE_POLL_TRIES = 36;


/** The call itself: ElevenLabs' web client, behind the VoiceSession shape. */
export function createVoiceSession(): VoiceSession {
  return new ElevenLabsVoiceSession();
}

function startProblem(error: unknown): string {
  const { status, message, errors } = extractApiError(error);
  const reason = (errors as { reason?: unknown } | null)?.reason;
  if (status === 403 && reason === 'no_access') return 'This page is for Lawexa staff with recording switched on.';
  if (status === 503 && reason === 'not_set_up') return 'The voice agents are not set up yet. Try again once Backend has made them.';
  return message || 'The call could not start. Try again.';
}

export class VoiceTestController {
  private state: VoiceTestState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private session: VoiceSession | null = null;
  private stopListening: (() => void) | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private connectedAt = 0;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private set(next: Partial<VoiceTestState>) {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }

  private busy() {
    return this.state.phase === 'starting' || this.state.phase === 'live' || this.state.phase === 'ending';
  }

  setMode = (mode: VoiceTestMode) => {
    if (!this.busy()) this.set({ mode });
  };

  setVoice = (voiceId: string) => {
    if (!this.busy()) this.set({ voiceId });
  };

  /** Call: a session from the server, then the call with its token, user id and voice. */
  start = async () => {
    if (this.busy()) return;
    const { mode, voiceId } = this.state;
    this.stopSavePoll();
    this.set({ phase: 'starting', problem: null, blocked: null, conversationUuid: null, saving: false, savingLate: false, outOfMessages: false, log: EMPTY_CALL_LOG, serverTurns: [], elapsed: 0, muted: false, sessionUuid: null });
    let started: VoiceTestSession;
    try {
      const answer = await voiceTestApi.start(mode, voiceId);
      if (!answer.data) throw new Error(answer.message);
      started = answer.data;
    } catch (error) {
      const blocked = exhaustedBlock(error);
      this.set({ phase: 'problem', blocked, problem: blocked ? null : startProblem(error) });
      return;
    }
    const voices = started.voices.length > 0 ? started.voices : this.state.voices;
    this.set({ sessionUuid: started.session_uuid, voices, voiceId: started.voice_id || voiceId, conversationUuid: started.conversation_uuid ?? null });

    const session = createVoiceSession();
    this.session = session;
    this.stopListening = onVoiceResearchReady((event) => {
      if (event.session_uuid !== this.state.sessionUuid || this.session !== session) return;
      if (mode === 'a') {
        // Lawexa voice: the answer waits for a quiet line, in arrival order.
        this.waitingResults.push(event);
        this.passResultIn();
        return;
      }
      session.sendUserMessage(event.marker);
      this.note({ kind: 'marker' });
    });
    try {
      await session.start(
        {
          conversationToken: started.conversation_token,
          userId: started.user_id,
          customLlmExtraBody: started.custom_llm_extra_body,
          voiceId: started.voice_id || voiceId,
          dynamicVariables: started.dynamic_variables,
        },
        {
          onStatus: (status) => {
            if (this.session !== session) return;
            if (status === 'connected') this.connected();
            if (status === 'disconnected' && this.state.phase === 'live') void this.end();
          },
          onMode: (mode) => {
            if (this.session !== session) return;
            this.note({ kind: 'mode', mode });
            // The answer in flight: when the voice started it, and since when it has been quiet.
            // A pause or an interruption leaves it in flight (voice-model.ts handOffFinished).
            if (this.inFlight && mode === 'speaking') {
              this.inFlight = { ...this.inFlight, startedAt: this.inFlight.startedAt ?? performance.now(), quietSince: null };
            }
            if (this.inFlight?.startedAt != null && mode === 'listening') this.inFlight = { ...this.inFlight, quietSince: performance.now() };
            if (mode === 'listening') {
              this.passResultIn();
              void this.readServerTurns();
            }
          },
          onMessage: (message) => {
            if (this.session !== session) return;
            if (message.source === 'user') this.callerVoiceAt = performance.now();
            // The voice's reply to the answer in flight: its length sizes how long it takes to say.
            if (message.source === 'ai' && this.inFlight && this.inFlight.answerChars === null) {
              this.inFlight = { ...this.inFlight, answerChars: message.text.length };
            }
            this.note({ kind: 'message', message });
          },
          onVad: (score) => {
            if (this.session === session && score >= CALLER_SPEECH_SCORE) this.callerVoiceAt = performance.now();
          },
          onError: (message) => {
            if (this.session !== session) return;
            this.set({ problem: message });
            void this.end();
          },
        },
      );
    } catch (error) {
      this.release();
      this.set({ phase: 'problem', problem: error instanceof Error && error.message ? error.message : 'The call could not connect. Try again.' });
    }
  };

  /** End: hang up, tell the server (it records the cost), then read the final timings. */
  end = async ({ leaving = false }: { leaving?: boolean } = {}) => {
    const session = this.session;
    const uuid = this.state.sessionUuid;
    if (!session || this.state.phase === 'ending' || this.state.phase === 'ended') return;
    this.set({ phase: 'ending' });
    const providerId = session.conversationId();
    this.release();
    await session.end().catch(() => {});
    const ended = uuid ? await voiceTestApi.end(uuid, providerId, { leaving }).catch(() => null) : null;
    if (leaving) return;
    if (ended?.data) this.applySaved(ended.data);
    await this.readServerTurns();
    this.set({ phase: 'ended' });
    if (uuid && !this.state.conversationUuid) this.startSavePoll(uuid);
  };

  toggleMute = () => {
    if (this.state.phase !== 'live' || !this.session) return;
    const muted = !this.state.muted;
    this.session.setMuted(muted);
    this.set({ muted });
  };

  /** The page is going away: hang up, and tell the server even as the tab closes. */
  dispose = () => {
    this.stopSavePoll();
    if (this.busy()) void this.end({ leaving: true });
  };

  private connected() {
    this.connectedAt = performance.now();
    this.ticker = setInterval(() => this.set({ elapsed: (performance.now() - this.connectedAt) / 1000 }), 500);
    this.set({ phase: 'live' });
  }

  private note(event: CallEvent) {
    this.set({ log: applyCallEvent(this.state.log, event, performance.now()) });
  }

  /** The server's timings, `c` calls only (a `b` call is answered and timed by ElevenLabs). */
  private async readServerTurns() {
    const uuid = this.state.sessionUuid;
    if (!uuid || this.state.mode === 'b') return;
    try {
      const answer = await voiceTestApi.turns(uuid);
      if (answer.data && uuid === this.state.sessionUuid) {
        this.set({ serverTurns: answer.data.turns });
        this.applySaved(answer.data);
      }
    } catch {
      // A missed read: the next answer, or the end, reads again.
    }
  }

  /** The chat link and the charge, from `end` or `turns`. */
  private applySaved(saved: Partial<VoiceCallSaved>) {
    this.set({
      conversationUuid: saved.conversation_uuid ?? this.state.conversationUuid,
      outOfMessages: saved.out_of_messages === true || this.state.outOfMessages,
    });
  }

  private savePoll: ReturnType<typeof setInterval> | null = null;

  /** A `b` call's chat is made after the call: ask every 5 s until it has an id, for up to 3 minutes. */
  private startSavePoll(uuid: string) {
    this.stopSavePoll();
    let tries = 0;
    this.set({ saving: true });
    this.savePoll = setInterval(() => {
      tries += 1;
      void voiceTestApi
        .turns(uuid)
        .then((answer) => {
          if (uuid !== this.state.sessionUuid || !answer.data) return;
          this.applySaved(answer.data);
          if (answer.data.conversation_uuid) this.stopSavePoll();
        })
        .catch(() => {});
      if (tries >= SAVE_POLL_TRIES) {
        this.stopSavePoll();
        if (!this.state.conversationUuid) this.set({ savingLate: true });
      }
    }, SAVE_POLL_MS);
  }

  private stopSavePoll() {
    if (this.savePoll) clearInterval(this.savePoll);
    this.savePoll = null;
    if (this.state.saving) this.set({ saving: false });
  }

  /** An `a` call's research answers, oldest first, waiting for a quiet line. */
  private waitingResults: VoiceResearchReadyEvent[] = [];
  /** The answer passed in and not yet read to the end. */
  private inFlight: HandOff | null = null;
  /** The caller's last voice activity (or finished line). */
  private callerVoiceAt: number | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;

  /**
   * Passes the oldest waiting research answer into the call when the line is
   * quiet: the voice not speaking, the caller not talking, and the answer
   * before it read to the end (voice-model.ts mayPassResultIn). While one
   * waits, it checks again shortly.
   */
  private passResultIn() {
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    const session = this.session;
    if (!session || this.waitingResults.length === 0) return;
    const now = performance.now();
    const may = mayPassResultIn({ now, live: this.state.phase === 'live', speaking: this.state.log.speaking, callerVoiceAt: this.callerVoiceAt, inFlight: this.inFlight });
    if (!may) {
      if (this.state.phase === 'live') this.retry = setTimeout(() => this.passResultIn(), 400);
      return;
    }
    const next = this.waitingResults.shift();
    if (!next) return;
    session.sendUserMessage(next.marker);
    this.inFlight = { turnUuid: next.turn_uuid, sentAt: now, startedAt: null, quietSince: null, answerChars: null };
    this.note({ kind: 'delivered', turnUuid: next.turn_uuid });
  }

  private release() {
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.inFlight = null;
    this.callerVoiceAt = null;
    this.waitingResults = [];
    this.session = null;
    this.stopListening?.();
    this.stopListening = null;
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }
}

import { voiceTestApi } from '@/lib/api/voice-test';
import { extractApiError } from '@/lib/utils/api-error';
import type { VoiceOption, VoiceServerTurn, VoiceTestMode, VoiceTestSession } from '@/types/voice-test';
import { PracticeVoiceSession } from './practice-voice-session';
import { onVoiceResearchReady } from './voice-events';
import { applyCallEvent, EMPTY_CALL_LOG, type CallEvent, type CallLog } from './voice-model';
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
  /** The stand-in call is running, not ElevenLabs. */
  practice: boolean;
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
  mode: 'c',
  voiceId: DEFAULT_VOICES[0].id,
  voices: DEFAULT_VOICES,
  muted: false,
  elapsed: 0,
  log: EMPTY_CALL_LOG,
  serverTurns: [],
  sessionUuid: null,
  problem: null,
  practice: false,
};

/** The call itself. The ElevenLabs client replaces the practice call here once its package is added. */
export function createVoiceSession(mode: VoiceTestMode): VoiceSession {
  return new PracticeVoiceSession(mode);
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
    this.set({ phase: 'starting', problem: null, log: EMPTY_CALL_LOG, serverTurns: [], elapsed: 0, muted: false, sessionUuid: null });
    let started: VoiceTestSession;
    try {
      const answer = await voiceTestApi.start(mode, voiceId);
      if (!answer.data) throw new Error(answer.message);
      started = answer.data;
    } catch (error) {
      this.set({ phase: 'problem', problem: startProblem(error) });
      return;
    }
    const voices = started.voices.length > 0 ? started.voices : this.state.voices;
    this.set({ sessionUuid: started.session_uuid, voices, voiceId: started.voice_id || voiceId });

    const session = createVoiceSession(mode);
    this.session = session;
    this.set({ practice: session.practice });
    this.stopListening = onVoiceResearchReady((event) => {
      if (event.session_uuid !== this.state.sessionUuid || this.session !== session) return;
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
            if (mode === 'listening') void this.readServerTurns();
          },
          onMessage: (message) => {
            if (this.session === session) this.note({ kind: 'message', message });
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
    if (uuid) await voiceTestApi.end(uuid, providerId, { leaving }).catch(() => {});
    if (leaving) return;
    await this.readServerTurns();
    this.set({ phase: 'ended' });
  };

  toggleMute = () => {
    if (this.state.phase !== 'live' || !this.session) return;
    const muted = !this.state.muted;
    this.session.setMuted(muted);
    this.set({ muted });
  };

  /** The page is going away: hang up, and tell the server even as the tab closes. */
  dispose = () => {
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
    if (!uuid || this.state.mode !== 'c') return;
    try {
      const answer = await voiceTestApi.turns(uuid);
      if (answer.data && uuid === this.state.sessionUuid) this.set({ serverTurns: answer.data.turns });
    } catch {
      // A missed read: the next answer, or the end, reads again.
    }
  }

  private release() {
    this.session = null;
    this.stopListening?.();
    this.stopListening = null;
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  }
}

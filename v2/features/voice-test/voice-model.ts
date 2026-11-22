import type { VoiceServerTurn } from '@/types/voice-test';
import type { VoiceCallMessage, VoiceCallMode } from './voice-session';
import { extractApiError } from '@/lib/utils/api-error';
import type { IBlockedReason } from '@/types/message-pack';

/**
 * The voice test page's transcript and its delay table (thread ac47b1df).
 *
 * The delays are measured here, in the browser, because that is what Stay
 * hears: from the moment the person's words come back as heard in full (the
 * end of their speech) to the moment the agent starts speaking. On a `c` call
 * that needs research the first sound is Lawexa's short holding line, and the
 * answer comes after the page sends the research marker; that second wait is
 * its own column. The server's own timings (`GET .../turns`) sit beside them,
 * so the table shows where the time went.
 */

/** A `c` call's research marker, sent on the call as a user line; never shown (Backend, 21 November 2026). */
export const RESEARCH_MARKER_PREFIX = '[[lawexa:research_ready:';

/** An `a` call's research answer, passed into the call (Backend, 22 November 2026). */
export const RESEARCH_RESULT_PREFIX = '[[LAWEXA RESULT';

/** A line the page sent into the call, never the caller's words: kept out of the transcript. */
export function isResearchMarker(text: string): boolean {
  const start = text.trimStart();
  return start.startsWith(RESEARCH_MARKER_PREFIX) || start.startsWith(RESEARCH_RESULT_PREFIX);
}

/**
 * The audio tags the server lets Lawexa speak, exactly (Backend f8f3b146,
 * 21 November 2026; case-insensitive, the whole bracket). Any other bracket is
 * ordinary text: "[2019] 1 NWLR", "[the appellant]".
 */
const AUDIO_TAGS = new Set([
  'laughs', 'laughs harder', 'starts laughing', 'wheezing', 'chuckles', 'giggles', 'whispers', 'sighs', 'exhales', 'inhales',
  'clears throat', 'gasps', 'coughs', 'pauses', 'sarcastic', 'curious', 'excited', 'crying', 'snorts', 'mischievously',
  'happy', 'sad', 'angry', 'slow', 'fast', 'thoughtful', 'surprised', 'serious', 'calm', 'warmly',
]);

/** What the agent said, without its audio tags: they are spoken, never shown. */
export function spokenText(text: string): string {
  return text
    .replace(/\[([^\]]*)\]/g, (bracket, inner: string) => (AUDIO_TAGS.has(inner.trim().toLowerCase()) ? ' ' : bracket))
    .replace(/\s+/g, ' ')
    .trim();
}

export interface TranscriptLine {
  id: string;
  who: 'you' | 'lawexa';
  text: string;
}

/** One question and what followed, timed in the browser (performance.now(), milliseconds). */
export interface BrowserTurn {
  userText: string;
  /** The person's words came back heard in full. */
  heardAt: number;
  /** The agent's first sound after it (on a research turn, the holding line). */
  firstSoundAt: number | null;
  aiText: string;
  /** The page sent the research marker. */
  markerAt: number | null;
  /** The agent started speaking the research answer. */
  answerSoundAt: number | null;
}

/** An `a` call's research answer the page passed into the call, and when the voice began reading it. */
export interface ResearchDelivery {
  turnUuid: string;
  sentAt: number;
  spokenAt: number | null;
}

export interface CallLog {
  lines: TranscriptLine[];
  turns: BrowserTurn[];
  speaking: boolean;
  deliveries: ResearchDelivery[];
}

export const EMPTY_CALL_LOG: CallLog = { lines: [], turns: [], speaking: false, deliveries: [] };

export type CallEvent =
  | { kind: 'message'; message: VoiceCallMessage }
  | { kind: 'mode'; mode: VoiceCallMode }
  | { kind: 'marker' }
  /** An `a` call's research answer was passed into the call. */
  | { kind: 'delivered'; turnUuid: string };

function withLastTurn(log: CallLog, change: (turn: BrowserTurn) => BrowserTurn): BrowserTurn[] {
  const last = log.turns.at(-1);
  return last ? [...log.turns.slice(0, -1), change(last)] : log.turns;
}

/** Add one call event, at `at` milliseconds. */
export function applyCallEvent(log: CallLog, event: CallEvent, at: number): CallLog {
  if (event.kind === 'marker') {
    return { ...log, turns: withLastTurn(log, (turn) => ({ ...turn, markerAt: at })) };
  }
  if (event.kind === 'delivered') {
    return { ...log, deliveries: [...log.deliveries, { turnUuid: event.turnUuid, sentAt: at, spokenAt: null }] };
  }
  if (event.kind === 'mode') {
    if (event.mode === 'listening') return { ...log, speaking: false };
    // The voice starts reading the oldest answer passed in and not yet read.
    const waiting = log.deliveries.findIndex((delivery) => delivery.spokenAt === null);
    const deliveries = waiting < 0 ? log.deliveries : log.deliveries.map((delivery, i) => (i === waiting ? { ...delivery, spokenAt: at } : delivery));
    const turns = withLastTurn(log, (turn) => {
      if (turn.firstSoundAt === null) return { ...turn, firstSoundAt: at };
      if (turn.markerAt !== null && turn.answerSoundAt === null) return { ...turn, answerSoundAt: at };
      return turn;
    });
    return { ...log, speaking: true, turns, deliveries };
  }
  const { source } = event.message;
  if (source === 'user') {
    const text = event.message.text.trim();
    if (!text || isResearchMarker(text)) return log;
    return {
      ...log,
      lines: [...log.lines, { id: `line-${log.lines.length}`, who: 'you', text }],
      turns: [...log.turns, { userText: text, heardAt: at, firstSoundAt: null, aiText: '', markerAt: null, answerSoundAt: null }],
    };
  }
  const text = spokenText(event.message.text);
  if (!text) return log;
  return {
    ...log,
    lines: [...log.lines, { id: `line-${log.lines.length}`, who: 'lawexa', text }],
    turns: withLastTurn(log, (turn) => ({ ...turn, aiText: turn.aiText ? `${turn.aiText} ${text}` : text })),
  };
}

export interface DelayRow {
  number: number;
  youSaid: string;
  lawexaSaid: string;
  /** Seconds from the end of the question to the first sound back. */
  firstSound: number | null;
  /** The first sound was Lawexa's holding line before research. */
  research: boolean;
  /** Seconds from the end of the question to the research answer starting. */
  answerSound: number | null;
  /** The server's time to its first text, and its research time, in seconds. */
  serverFirstText: number | null;
  serverResearch: number | null;
}

const seconds = (from: number | null, to: number | null): number | null =>
  from === null || to === null ? null : Math.max(0, (to - from) / 1000);

const fromMs = (ms: number | null): number | null => (ms === null ? null : ms / 1000);

/**
 * The table: one row per question, the browser's timings first, the server's
 * beside them. A `c` call's server turns are matched in order (each one is a
 * question the person asked; the research marker is not a turn).
 */
export function delayRows(turns: BrowserTurn[], serverTurns: VoiceServerTurn[]): DelayRow[] {
  return turns.map((turn, index) => {
    const server = serverTurns[index];
    return {
      number: index + 1,
      youSaid: turn.userText,
      lawexaSaid: turn.aiText,
      firstSound: seconds(turn.heardAt, turn.firstSoundAt),
      research: server?.kind === 'research' || turn.markerAt !== null,
      answerSound: seconds(turn.heardAt, turn.answerSoundAt),
      serverFirstText: fromMs(server?.first_text_ms ?? null),
      serverResearch: fromMs(server?.research_ms ?? null),
    };
  });
}

/**
 * When the page may pass an `a` call's next research answer in (Techlead's
 * review, 22 November 2026): never while the voice speaks or the caller is
 * talking, and one at a time: the next waits until the voice has started
 * and finished reading the one before. Timeouts keep an answer from waiting
 * forever if the voice never starts or never stops.
 */
export const CALLER_QUIET_MS = 900;
/** The client's voice activity score at or above which the caller counts as talking. */
export const CALLER_SPEECH_SCORE = 0.5;
export const START_TIMEOUT_MS = 8000;
export const READ_TIMEOUT_MS = 120000;

/** The answer passed in and not yet read to the end. */
export interface HandOff {
  turnUuid: string;
  sentAt: number;
  /** The voice started reading it; `null` until then. */
  startedAt: number | null;
}

export function mayPassResultIn(state: { now: number; live: boolean; speaking: boolean; callerVoiceAt: number | null; inFlight: HandOff | null }): boolean {
  const { now, live, speaking, callerVoiceAt, inFlight } = state;
  if (!live || speaking) return false;
  if (callerVoiceAt !== null && now - callerVoiceAt < CALLER_QUIET_MS) return false;
  if (!inFlight) return true;
  return inFlight.startedAt === null ? now - inFlight.sentAt >= START_TIMEOUT_MS : now - inFlight.startedAt >= READ_TIMEOUT_MS;
}

export interface ResearchRow {
  number: number;
  question: string;
  /** Still waiting behind another research. */
  queued: boolean;
  /** The server's research time, in seconds. */
  research: number | null;
  /** Seconds from the page passing the answer in to the voice starting to read it. */
  spokenAfter: number | null;
}

/**
 * An `a` call's research table: one row per research the server ran, with its
 * time, and how soon the voice read the answer once the page passed it in
 * (the server cannot see that; Backend, 22 November 2026).
 */
export function researchRows(serverTurns: VoiceServerTurn[], deliveries: ResearchDelivery[]): ResearchRow[] {
  return serverTurns
    .filter((turn) => turn.kind === 'research' || turn.kind === 'queued')
    .map((turn, index) => {
      const delivery = deliveries.find((candidate) => candidate.turnUuid === turn.uuid);
      return {
        number: index + 1,
        question: turn.user_text,
        queued: turn.kind === 'queued',
        research: fromMs(turn.research_ms),
        spokenAfter: delivery ? seconds(delivery.sentAt, delivery.spokenAt) : null,
      };
    });
}

/** A call's length as m:ss. */
export function callClock(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** "1.4 s", or a dash when there is nothing to show. */
export function secondsLabel(value: number | null): string {
  return value === null ? '–' : `${value.toFixed(1)} s`;
}

const csvField = (value: string | number | null): string => {
  const text = value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** The table as CSV, for the thread. */
export function delayCsv(rows: DelayRow[], mode: string, voice: string): string {
  const header = ['call', 'voice', 'turn', 'you said', 'lawexa said', 'first sound s', 'research', 'answer sound s', 'server first text s', 'server research s'];
  const round = (value: number | null) => (value === null ? null : Number(value.toFixed(2)));
  const lines = rows.map((row) =>
    [mode, voice, row.number, row.youSaid, row.lawexaSaid, round(row.firstSound), row.research ? 'yes' : 'no', round(row.answerSound), round(row.serverFirstText), round(row.serverResearch)]
      .map(csvField)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

/** Out of messages at Call: the same 403 and block typed chat gets (Backend c21b513c), for the shared notice. */
export function exhaustedBlock(error: unknown): IBlockedReason | null {
  const { status, errors } = extractApiError(error);
  const block = errors as Partial<IBlockedReason> | null;
  return status === 403 && block?.code === 'ai_messages_exhausted' ? (block as IBlockedReason) : null;
}

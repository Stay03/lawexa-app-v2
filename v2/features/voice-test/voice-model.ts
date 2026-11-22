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

/**
 * An `a` call's "still working" nudge (Backend, 22 November 2026): the server
 * sends it for a research turn still running after Stay's 6 seconds, on the
 * same event with the turn's own id, so the voice says one holding line.
 */
export const STILL_WORKING_PREFIX = '[[LAWEXA STILL WORKING';

export function isStillWorking(marker: string): boolean {
  return marker.trimStart().startsWith(STILL_WORKING_PREFIX);
}

/** A line the page sent into the call, never the caller's words: kept out of the transcript. */
export function isResearchMarker(text: string): boolean {
  const start = text.trimStart();
  return start.startsWith(RESEARCH_MARKER_PREFIX) || start.startsWith(RESEARCH_RESULT_PREFIX) || start.startsWith(STILL_WORKING_PREFIX);
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
 * reviews, 22 November 2026). Never while the voice speaks or the caller is
 * talking, and one at a time: the next waits until the voice has finished the
 * one before.
 *
 * "Finished" cannot be the first 'listening'. On a WebRTC call the client's
 * speaking/listening comes from the audio's voice activity (LiveKit's active
 * speakers), so every pause between sentences reads as 'listening'; in Stay's
 * call a pause 98 s into a several-minute answer let the next one in and cut
 * it. So an answer counts as finished only when 'listening' has held for
 * HELD_LISTENING_MS AND at least its expected spoken length has passed since
 * it started (its text at SPOKEN_CHARS_PER_SECOND, capped at the longest
 * result Backend sends). A real interruption (the client's interruption
 * event; a sentence pause raises none) ends the answer for good, since the
 * voice never resumes a cut reply: it then needs only the held quiet. Held
 * quiet is required in every case, so no timer can let the next answer in at
 * a pause; the caller moving on is covered by the interruption. Only the
 * start has a timeout, for an answer the voice never begins.
 */
export const CALLER_QUIET_MS = 900;
/** The client's voice activity score at or above which the caller counts as talking. */
export const CALLER_SPEECH_SCORE = 0.5;
export const HELD_LISTENING_MS = 3000;
/** A steady speaking pace, so a long answer is not counted done at a pause. */
export const SPOKEN_CHARS_PER_SECOND = 14;
export const START_TIMEOUT_MS = 8000;
/** The longest research answer Backend passes into a call (VoiceTurns::FRONT_RESULT_MAX_CHARS). */
export const RESULT_MAX_CHARS = 6000;
/** No answer is expected to take longer than the longest result takes to say (about 429 s). */
export const MAX_EXPECTED_MS = (RESULT_MAX_CHARS / SPOKEN_CHARS_PER_SECOND) * 1000;

/** The answer passed in and not yet read to the end. */
export interface HandOff {
  turnUuid: string;
  sentAt: number;
  /** The voice started reading it; `null` until then. */
  startedAt: number | null;
  /** The voice went quiet at this time and has stayed quiet; `null` while it speaks. */
  quietSince: number | null;
  /** The length of the voice's longest reply since the answer went in; `null` until one arrives after it. */
  answerChars: number | null;
  /** The voice was cut off while reading it: it will not resume. */
  interrupted: boolean;
}

/** How long a reply of `chars` characters takes to say. */
export function expectedSpokenMs(chars: number | null): number {
  return chars === null ? 0 : Math.min(MAX_EXPECTED_MS, (chars / SPOKEN_CHARS_PER_SECOND) * 1000);
}

/** The answer in flight has been read to the end (or never started). */
export function handOffFinished(inFlight: HandOff, now: number): boolean {
  if (inFlight.startedAt === null) return now - inFlight.sentAt >= START_TIMEOUT_MS;
  const heldQuiet = inFlight.quietSince !== null && now - inFlight.quietSince >= HELD_LISTENING_MS;
  if (!heldQuiet) return false;
  return inFlight.interrupted || now - inFlight.startedAt >= expectedSpokenMs(inFlight.answerChars);
}

/** The voice started or stopped speaking while the answer is in flight. */
export function handOffOnMode(inFlight: HandOff, mode: VoiceCallMode, now: number): HandOff {
  if (mode === 'speaking') return { ...inFlight, startedAt: inFlight.startedAt ?? now, quietSince: null };
  return inFlight.startedAt === null ? inFlight : { ...inFlight, quietSince: now };
}

/**
 * A reply from the voice after the answer went in. The longest one sizes how
 * long the answer takes to say, so a short reply to the caller ("Sure, one
 * moment") never stands in for the long answer.
 */
export function handOffOnReply(inFlight: HandOff, chars: number): HandOff {
  return { ...inFlight, answerChars: Math.max(inFlight.answerChars ?? 0, chars) };
}

/**
 * The caller cut the voice off. It counts against the answer only once a reply
 * has arrived after the answer went in: before that the voice is still saying
 * its own earlier reply, and cutting that does not end the answer.
 */
export function handOffOnInterruption(inFlight: HandOff): HandOff {
  return inFlight.startedAt === null || inFlight.answerChars === null ? inFlight : { ...inFlight, interrupted: true };
}

export function mayPassResultIn(state: { now: number; live: boolean; speaking: boolean; callerVoiceAt: number | null; inFlight: HandOff | null }): boolean {
  const { now, live, speaking, callerVoiceAt, inFlight } = state;
  if (!live || speaking) return false;
  if (callerVoiceAt !== null && now - callerVoiceAt < CALLER_QUIET_MS) return false;
  return !inFlight || handOffFinished(inFlight, now);
}

/**
 * The outcome of an action the caller said yes to ("Reminder set for 9 am"),
 * sent by the server as a result whose turn is `action-<code>` (Techlead and
 * Backend, 22 November 2026, branch voice-held-actions). It goes into the call
 * by the same quiet-line rule as a research answer, one at a time, but it is
 * not a research turn: the server is not told when it went in.
 */
export const ACTION_OUTCOME_PREFIX = 'action-';

export function isActionOutcome(turnUuid: string): boolean {
  return turnUuid.startsWith(ACTION_OUTCOME_PREFIX);
}

/**
 * The research turn the server is told about once its result goes into the
 * call (`POST .../turns/{turn}/sent`), so it knows when the read-back started:
 * a held action's yes is refused until the read-back has had time to be said.
 * `null` for an action outcome, which has no turn, and for a nudge, which is
 * not the result.
 */
export function sentNoticeTurn(event: { turn_uuid: string; marker: string }): string | null {
  return isActionOutcome(event.turn_uuid) || isStillWorking(event.marker) ? null : event.turn_uuid;
}

/** An `a` call's results, action outcomes and nudges waiting for a quiet line, oldest first. */
export interface ResultLine<T> {
  waiting: T[];
  /** Every event (turn and text) taken in on this call, so a repeat is not read twice. */
  seen: Set<string>;
  /** Turns whose result is waiting, in flight or read: a nudge for them is never said. */
  answered: Set<string>;
}

export function emptyResultLine<T>(): ResultLine<T> {
  return { waiting: [], seen: new Set(), answered: new Set() };
}

/**
 * Takes an event into the waiting line (Techlead and Backend, 22 November 2026).
 *
 * - A repeat of an event already taken in (the same turn AND the same text) is
 *   dropped, so the voice never reads it twice. Keyed on both because a nudge
 *   shares its turn's id with the result.
 * - A "still working" nudge is dropped when its turn's result is already
 *   waiting, in flight or read: the voice never says "still working" after
 *   the answer, or just before it.
 * - A result takes out any nudge for its turn still waiting, for the same
 *   reason. A nudge already passed in stays: it is short, and the result
 *   follows it by the one-at-a-time rule.
 */
export function admitResult<T extends { turn_uuid: string; marker: string }>(
  line: ResultLine<T>,
  event: T,
): { line: ResultLine<T>; accepted: boolean } {
  const key = `${event.turn_uuid}\n${event.marker}`;
  if (line.seen.has(key)) return { line, accepted: false };
  const seen = new Set([...line.seen, key]);
  if (isStillWorking(event.marker)) {
    if (line.answered.has(event.turn_uuid)) return { line: { ...line, seen }, accepted: false };
    return { line: { ...line, seen, waiting: [...line.waiting, event] }, accepted: true };
  }
  const waiting = line.waiting.filter((queued) => !(queued.turn_uuid === event.turn_uuid && isStillWorking(queued.marker)));
  return { line: { waiting: [...waiting, event], seen, answered: new Set([...line.answered, event.turn_uuid]) }, accepted: true };
}

export interface ResearchRow {
  number: number;
  question: string;
  /** `done` ran; `queued` waits behind another; `failed` could not start; `dropped` was still waiting at the end. */
  status: 'done' | 'queued' | 'failed' | 'dropped';
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
    .filter((turn) => turn.kind !== 'answer')
    .map((turn, index) => {
      const delivery = deliveries.find((candidate) => candidate.turnUuid === turn.uuid);
      return {
        number: index + 1,
        question: turn.user_text,
        status: turn.kind === 'research' || turn.kind === 'answer' ? 'done' : turn.kind,
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

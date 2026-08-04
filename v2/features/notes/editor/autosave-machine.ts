import type { NoteCreateInput, NoteUpdateInput } from '../types';

/**
 * autosave-machine — the note editor's save logic as a PURE state machine.
 *
 * No React, no timers, no network: every input is an event carrying the time it
 * happened, and every output is a new state plus (at most) one request to send.
 * The hook that drives it (`use-autosave.ts`) owns the clock and the wire; this
 * module owns the decisions. That split is what makes the hard parts — the
 * create→update transition, single-flight, the 429 contract, the give-up rule —
 * readable and testable on fixtures rather than reproducible only by typing fast
 * with a throttled network.
 *
 * ── THE SHAPE OF A SAVE ─────────────────────────────────────────────────────
 * A note does not exist until the FIRST real change. Then:
 *
 *     no note yet  ──first change──▶  POST /notes  ──▶  id + slug
 *     note exists  ──any change───▶  PUT  /notes/{id}
 *
 * The slug is minted once at creation and is never sent again (the update type
 * cannot even carry it — see `../types.ts`), so a save can never move a note's
 * address. Untitled is a first-class state: `title: null` is sent as-is.
 *
 * ── WHEN A SAVE FIRES ───────────────────────────────────────────────────────
 * One deadline, computed from two anchors (the lodash `debounce(fn, wait,
 * {maxWait})` shape, spelled out rather than imported):
 *
 *     deadline = min(lastChangeAt + 1.5s,  dirtySince + 45s)
 *
 * The first term is the idle debounce — stop typing for 1.5s and the save goes.
 * The second is the heartbeat ceiling: someone who types continuously for a
 * minute still has their work saved at 45s, because the idle term would never
 * come due. ONE deadline rather than a debounce plus an independent interval,
 * deliberately: two timers can both come due and start two requests, which is
 * the exact race the single-flight rule below exists to prevent.
 *
 * ── EXACTLY ONE SAVE IN FLIGHT ──────────────────────────────────────────────
 * `status === 'saving'` arms nothing. Changes made while a request is on the
 * wire update `working` and nothing else; the follow-up deadline is computed
 * when that request SETTLES. So two changes either side of a create can never
 * produce two POSTs, and no response can ever land out of order — there is only
 * ever one.
 *
 * ── FAILURE, HONESTLY ───────────────────────────────────────────────────────
 * The backend's notes bucket allows 60 saves/min and answers overflow with 429.
 * The two 429s mean different things and this machine treats them differently
 * (the contract is the backend's 2026-08-04 reply, restated in `../types.ts`):
 *
 *   429 WITH `Retry-After`   the rate limit. Hold for exactly that long, then
 *                            retry with the FRESHEST content — never a replay
 *                            of the payload that was rejected.
 *   429 WITHOUT it, on POST  the plan's note-creation quota. No amount of
 *                            waiting fixes it, so the machine stops
 *                            (`blocked`), the editor keeps working locally, and
 *                            the screen states the limit instead of pretending
 *                            to retry.
 *
 * Anything else transient (network, 5xx) backs off exponentially and gives up
 * after four consecutive failures — at which point the state stays `error` with
 * no armed retry, and only a deliberate act (the retry chip, or the flush on
 * tab-hide) tries again. Typing does NOT silently resume the ladder: a broken
 * endpoint must not be hammered once per typing pause for as long as someone
 * writes.
 */

/** The working copy of a note, as the editor holds it and the wire sends it. */
export interface NoteDraft {
  /** `null` is an untitled note — a real, saveable state, not a missing value. */
  title: string | null;
  /** The full HTML body. */
  content: string;
}

/** The timing contract, in one place so a tune is one edit and a test can read it. */
export const AUTOSAVE_TIMING = {
  /** Idle debounce — stop typing this long and the save goes. */
  idleDebounceMs: 1_500,
  /** Heartbeat ceiling — continuous typing still saves this often. */
  heartbeatMs: 45_000,
  /** First transient-failure backoff; doubles per consecutive failure. */
  retryBaseMs: 2_000,
  /** Cap on the doubling, so a long outage retries steadily rather than hourly. */
  retryCeilingMs: 30_000,
  /** Consecutive transient failures after which the machine waits for the reader. */
  maxAutoRetries: 4,
} as const;

/**
 * The backend's content cap: 5MB of characters (`../types.ts`). The 65,535
 * figure v1 counted down from is dead and must never be shown again.
 */
export const NOTE_CONTENT_LIMIT = 5_242_880;

/** True when the body has outgrown what the backend will accept. */
export function isOverContentLimit(draft: NoteDraft): boolean {
  return draft.content.length > NOTE_CONTENT_LIMIT;
}

export type AutosaveStatus =
  /** Everything typed is on the server (or nothing has been typed yet). */
  | 'clean'
  /** Unsaved work with a save scheduled — `wakeAt` says when. */
  | 'pending'
  /** A request is on the wire. Nothing else may start until it settles. */
  | 'saving'
  /** The last attempt failed. `wakeAt` non-null ⇒ a retry is scheduled. */
  | 'error'
  /** The plan's note-creation quota. No note can be created; editing is local. */
  | 'blocked';

/** Why a save failed, in the only four flavours that change what we do next. */
export type AutosaveFailure =
  /** 429 WITH `Retry-After` — the notes rate limit. Hold, then retry. */
  | { kind: 'rate-limited'; retryAfterMs: number; message: string }
  /** 429 WITHOUT `Retry-After` on a create — the plan's note-creation quota. */
  | { kind: 'create-quota'; message: string }
  /** Network / 5xx — worth retrying on a backoff ladder. */
  | { kind: 'transient'; message: string }
  /** A settled refusal (422, 403). Retrying it would fail identically. */
  | { kind: 'rejected'; message: string };

export interface AutosaveState {
  readonly status: AutosaveStatus;
  /** The server id, once the note exists. `null` ⇒ the next save is a create. */
  readonly noteId: number | null;
  /** What the server last confirmed. `null` ⇒ nothing has ever been saved. */
  readonly confirmed: NoteDraft | null;
  /** What the reader has now — always the freshest full snapshot. */
  readonly working: NoteDraft;
  /** The snapshot the in-flight request carries, or `null` when nothing is in flight. */
  readonly inFlight: NoteDraft | null;
  /** When the most recent change landed — the idle-debounce anchor. */
  readonly lastChangeAt: number | null;
  /** When the current unsaved burst began — the heartbeat-ceiling anchor. */
  readonly dirtySince: number | null;
  /** When the last save succeeded — what the transient "Saved" flash reads. */
  readonly savedAt: number | null;
  /** Absolute time the driver should wake this machine, or `null` for no timer. */
  readonly wakeAt: number | null;
  /**
   * A floor no save may start before — set only by a failure (rate-limit hold or
   * backoff). Distinct from `wakeAt`, which in `pending` is merely the debounce
   * deadline a flush is allowed to jump.
   */
  readonly holdUntil: number | null;
  /** Consecutive transient/rate-limited failures, for the backoff ladder. */
  readonly attempt: number;
  /** The last failure, kept for the inline chip's copy. */
  readonly failure: AutosaveFailure | null;
}

/**
 * What the driver should send, if anything. A UNION rather than a struct with a
 * nullable id: `mode === 'update'` and "we know the id" are the same fact, and
 * modelling them together means the wire layer never needs a non-null assertion.
 */
export type SaveRequest =
  | { readonly mode: 'create'; readonly draft: NoteDraft }
  | { readonly mode: 'update'; readonly noteId: number; readonly draft: NoteDraft };

export type AutosaveEvent =
  /** The reader changed the title or the body. Carries the FULL new draft. */
  | { type: 'edit'; draft: NoteDraft; at: number }
  /** The armed timer came due. */
  | { type: 'wake'; at: number }
  /** Save now if there is anything to save (tab hidden, page hiding, save-now). */
  | { type: 'flush'; at: number }
  /** The request succeeded; the server's record is authoritative. */
  | { type: 'saved'; noteId: number; draft: NoteDraft; at: number }
  /** The request failed. */
  | { type: 'failed'; failure: AutosaveFailure; at: number }
  /** The reader pressed the retry chip. */
  | { type: 'retry'; at: number };

/** A transition: the next state, and the one request the driver should send. */
export interface AutosaveTransition {
  readonly state: AutosaveState;
  /** Non-null exactly when this transition starts a request. */
  readonly save: SaveRequest | null;
}

/** The empty body Tiptap reports for a doc with nothing in it. */
const EMPTY_CONTENT = '';

/** Elements that carry meaning without carrying text — a blank test must respect them. */
const EMBEDDED_CONTENT = /<(img|hr|iframe|video|audio)\b/i;

/**
 * True when a body holds nothing a reader would call content. Tiptap serialises
 * an untouched document as `<p></p>`, so a literal emptiness test would create a
 * note the moment the editor mounts — which is exactly what "no note exists
 * until the first change" forbids.
 *
 * Conservative on purpose: an embedded image counts as content even though it
 * contributes no text, and anything that leaves a single visible character
 * behind is not blank.
 */
export function isBlankContent(content: string): boolean {
  if (EMBEDDED_CONTENT.test(content)) return false;
  const text = content
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, '');
  return text.length === 0;
}

/** True when a draft holds neither a title nor a body worth creating a note for. */
export function isBlankDraft(draft: NoteDraft): boolean {
  return (draft.title ?? '').trim().length === 0 && isBlankContent(draft.content);
}

function sameDraft(a: NoteDraft, b: NoteDraft): boolean {
  return a.title === b.title && a.content === b.content;
}

/**
 * Is there work the server does not have?
 *
 * Before the note exists the test is "is this worth creating a note for" —
 * blank is not. Once it exists, ANY divergence from the confirmed copy counts,
 * including clearing the body: emptying a note is an edit the author meant.
 */
export function hasUnsavedWork(state: AutosaveState): boolean {
  if (state.confirmed === null) return !isBlankDraft(state.working);
  return !sameDraft(state.working, state.confirmed);
}

/** The one deadline: idle debounce, ceilinged by the heartbeat (see the header). */
function deadlineFor(state: AutosaveState, at: number): number {
  const idle = (state.lastChangeAt ?? at) + AUTOSAVE_TIMING.idleDebounceMs;
  const ceiling = (state.dirtySince ?? at) + AUTOSAVE_TIMING.heartbeatMs;
  const soonest = Math.min(idle, ceiling);
  // A hold from a previous failure outranks both: the rate limit is the
  // server's window, not ours to shorten.
  return state.holdUntil === null ? soonest : Math.max(soonest, state.holdUntil);
}

function requestFor(state: AutosaveState): SaveRequest {
  return state.noteId === null
    ? { mode: 'create', draft: state.working }
    : { mode: 'update', noteId: state.noteId, draft: state.working };
}

/** Move to `saving` and hand the driver the request. */
function startSaving(state: AutosaveState): AutosaveTransition {
  const request = requestFor(state);
  return {
    state: {
      ...state,
      status: 'saving',
      inFlight: request.draft,
      wakeAt: null,
    },
    save: request,
  };
}

/** Nothing to send — settle to `clean` and forget the dirty anchors. */
function settleClean(state: AutosaveState): AutosaveTransition {
  return {
    state: {
      ...state,
      status: 'clean',
      wakeAt: null,
      dirtySince: null,
      holdUntil: null,
      attempt: 0,
      failure: null,
    },
    save: null,
  };
}

/** The starting state for an editor, with or without an existing note. */
export function initialAutosaveState(
  note: { id: number; draft: NoteDraft } | null,
): AutosaveState {
  return {
    status: 'clean',
    noteId: note?.id ?? null,
    confirmed: note?.draft ?? null,
    working: note?.draft ?? { title: null, content: EMPTY_CONTENT },
    inFlight: null,
    lastChangeAt: null,
    dirtySince: null,
    savedAt: null,
    wakeAt: null,
    holdUntil: null,
    attempt: 0,
    failure: null,
  };
}

/**
 * The machine. Pure: same state + same event ⇒ same transition, every time.
 */
export function reduceAutosave(
  state: AutosaveState,
  event: AutosaveEvent,
): AutosaveTransition {
  switch (event.type) {
    case 'edit': {
      const next: AutosaveState = {
        ...state,
        working: event.draft,
        lastChangeAt: event.at,
        dirtySince: state.dirtySince ?? event.at,
      };

      // A save is on the wire: record the change and wait. The follow-up
      // deadline is set when that request settles — this is the single-flight
      // rule, and it is the whole reason two rapid changes cannot double-create.
      if (state.status === 'saving') return { state: next, save: null };

      // The create quota is not a timing problem, so nothing is scheduled.
      // Editing continues; the local mirror is what holds the work.
      if (state.status === 'blocked') return { state: next, save: null };

      // Typed back to what the server already has (an undo, a deleted keystroke)
      // — there is nothing to send, so stand down rather than save a no-op.
      if (!hasUnsavedWork(next)) return settleClean(next);

      // Already given up after repeated failures: keep the freshest content for
      // whenever a retry is asked for, but do not resume the ladder on typing.
      if (state.status === 'error' && state.wakeAt === null) {
        return { state: next, save: null };
      }

      // A retry is already armed: keep its timing (the hold is the server's
      // window) — the retry will carry this newer content when it fires.
      if (state.status === 'error') return { state: next, save: null };

      return {
        state: { ...next, status: 'pending', wakeAt: deadlineFor(next, event.at) },
        save: null,
      };
    }

    case 'wake': {
      // Only a scheduled state has a timer; anything else is a stale wake.
      if (state.status !== 'pending' && state.status !== 'error') {
        return { state, save: null };
      }
      if (state.wakeAt === null) return { state, save: null };
      if (!hasUnsavedWork(state)) return settleClean(state);
      return startSaving({ ...state, holdUntil: null });
    }

    case 'flush': {
      // One in flight already — the work is either in it or will follow when it
      // settles. Never a second request.
      if (state.status === 'saving') return { state, save: null };
      // A rate-limit or backoff hold outranks a flush: hitting a closed window
      // early only earns another 429.
      if (state.holdUntil !== null && event.at < state.holdUntil) {
        return { state, save: null };
      }
      if (state.status === 'blocked') return { state, save: null };
      if (!hasUnsavedWork(state)) {
        return state.status === 'clean' ? { state, save: null } : settleClean(state);
      }
      return startSaving({ ...state, holdUntil: null });
    }

    case 'saved': {
      const settled: AutosaveState = {
        ...state,
        noteId: event.noteId,
        confirmed: event.draft,
        inFlight: null,
        savedAt: event.at,
        attempt: 0,
        holdUntil: null,
        failure: null,
      };

      // Everything the reader typed is now on the server.
      if (!hasUnsavedWork(settled)) return settleClean(settled);

      // They kept typing while it was in flight. A fresh heartbeat window opens
      // now (the previous one closed with this save), so the next deadline is
      // measured from here.
      const restarted: AutosaveState = { ...settled, dirtySince: event.at };
      return {
        state: {
          ...restarted,
          status: 'pending',
          wakeAt: deadlineFor(restarted, event.at),
        },
        save: null,
      };
    }

    case 'failed': {
      const { failure } = event;
      // ONE LADDER, AND ONLY TRANSIENT FAILURES CLIMB IT.
      //
      // `attempt` exists to answer "how many times in a row has this genuinely
      // failed?", and a rate limit is not a failure — it is the server telling
      // us when to come back, and coming back then works. Counting 429s here
      // meant that a busy minute (five rate limits) followed by ONE dropped
      // request landed on attempt 6, tripped the give-up rule immediately, and
      // parked autosave with no timer and no warning.
      //
      // So a non-transient failure RESETS the counter, and it does so HERE —
      // in the state every branch below is built from — rather than in the
      // ladder branch alone, so a quota or a refusal cannot leave a stale count
      // behind for the next genuine failure to inherit.
      const attempt = failure.kind === 'transient' ? state.attempt + 1 : 0;

      const base: AutosaveState = {
        ...state,
        inFlight: null,
        failure,
        status: 'error',
        attempt,
      };

      if (failure.kind === 'create-quota') {
        return {
          state: { ...base, status: 'blocked', wakeAt: null, holdUntil: null },
          save: null,
        };
      }

      if (failure.kind === 'rejected') {
        // Retrying an identical refusal is theatre. The chip stays until the
        // reader acts (usually by fixing what was refused).
        return { state: { ...base, wakeAt: null, holdUntil: null }, save: null };
      }

      const holdMs =
        failure.kind === 'rate-limited'
          ? failure.retryAfterMs
          : Math.min(
              AUTOSAVE_TIMING.retryBaseMs * 2 ** (attempt - 1),
              AUTOSAVE_TIMING.retryCeilingMs,
            );
      const holdUntil = event.at + holdMs;

      const givenUp =
        failure.kind === 'transient' && attempt > AUTOSAVE_TIMING.maxAutoRetries;

      return {
        state: {
          ...base,
          holdUntil: givenUp ? null : holdUntil,
          wakeAt: givenUp ? null : holdUntil,
        },
        save: null,
      };
    }

    case 'retry': {
      // A deliberate act clears the ladder and any hold — including the create
      // quota, which a reader may have freed up elsewhere.
      if (state.status === 'saving') return { state, save: null };
      const cleared: AutosaveState = {
        ...state,
        attempt: 0,
        holdUntil: null,
        failure: null,
      };
      if (!hasUnsavedWork(cleared)) return settleClean(cleared);
      return startSaving(cleared);
    }
  }
}

/** The create payload. Never carries a slug — the backend mints a stable one. */
export function createInputFor(draft: NoteDraft): NoteCreateInput {
  return { title: draft.title, content: draft.content };
}

/**
 * The update payload. Title and content are both always sent: the editor always
 * knows both, and `title: null` is how an untitled note stays untitled. `slug`
 * is absent because {@link NoteUpdateInput} cannot express it — sending a
 * changed slug is the one save that breaks every existing link to a note.
 */
export function updateInputFor(draft: NoteDraft): NoteUpdateInput {
  return { title: draft.title, content: draft.content };
}

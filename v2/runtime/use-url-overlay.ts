'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  quietPushUrlParams,
  quietReplaceUrlParams,
  readHistoryStamp,
} from './url-params';

/**
 * useUrlOverlay — the ONE way a v2 overlay (dialog, sheet, mode) puts itself in
 * the URL, so the Back button closes it.
 *
 * ── WHY THIS EXISTS (owner, 2026-08-04) ────────────────────────────────────
 * "create and edit space should have url state or something so back button and
 * all that works, all the modals and sidebar should be like that." Measured the
 * same day: 53 overlays across the collab surfaces, 3 of which answered Back.
 * Everything else was local `useState`, so on a phone — where Back is the
 * universal dismiss — the only way out of a dialog was to find its Cancel.
 *
 * ── THE STATE IS `string | null`, NOT A BOOLEAN ────────────────────────────
 * `null` is closed. A plain modal opens at {@link OPEN_VALUE} (`'1'`); an
 * overlay that NAMES the thing it is showing opens at that name (a uuid, or a
 * readable key like `members`). One param can therefore carry a whole family of
 * mutually exclusive panels on one screen — `?panel=edit`, `?panel=members`,
 * `?panel=ai:{uuid}` — and moving between them is free.
 *
 * STACKED overlays need SEPARATE params, because one param holds one value: the
 * invite dialog that opens ON TOP of a members sheet is its own key, so the URL
 * reads `?panel=members&invite=1` and Back unwinds them in the order they were
 * opened. One hook instance per param, and exactly one component owns each —
 * two components sharing a param would each hold their own copy of it and the
 * second write would clobber the first.
 *
 * ── LAZY-INIT READS THE LIVE URL, NEVER A REACT SNAPSHOT ───────────────────
 * The writers below are QUIET (see `url-params.ts`): they move the address bar
 * without waking the App Router, so `useSearchParams()` and the navigation-time
 * props derived from it can be STALE while the URL is current — a Back/Forward
 * restore serves the page with the props it had at push time. The address bar
 * is the truth, so that is what is read. `ssrValue` covers the server render,
 * where there is no `window`; it must be derived from the SAME navigation URL
 * (a `searchParams` prop) so the server render and the hydration render agree.
 *
 * `null` is the right `ssrValue` for a pure overlay: Radix portals render
 * nothing until they have mounted, so a panel that is open in the URL produces
 * no server HTML either way and hydration cannot diverge. Pass a real fallback
 * only when the value also drives IN-TREE markup (`ChannelScreen`'s `?game=`
 * covers the whole screen; `ListsTab`'s `?list=` swaps index for detail).
 *
 * ── ONE ENTRY PER OVERLAY, AND IT IS REMOVED AGAIN ON CLOSE ────────────────
 * {@link UrlOverlay.show} PUSHes one entry the FIRST time a param opens, so
 * Back closes the overlay. Re-targeting an already-open param — and
 * {@link UrlOverlay.swap}, which drilling inside a panel uses — REPLACES, so an
 * overlay costs exactly ONE entry however far the reader goes inside it, and
 * Back never walks internal hops or reveals whichever panel was open before.
 *
 * {@link UrlOverlay.close} WALKS BACK OVER ITS OWN ENTRY rather than replacing
 * it. Replacing looks equivalent and is not: it leaves an entry whose URL
 * equals its neighbour's, and that duplicate is per CYCLE, not per session — a
 * reader who opened and closed Pinned, Saved, Members and Quizzes would need
 * five Back presses to leave the channel, and the first four would do nothing
 * at all. So `show` STAMPS the entry it pushes with this param's name, and
 * `close` calls `history.back()` only when the current entry carries that stamp.
 *
 * The stamp is what keeps the other half safe. A shared `/spaces/x?panel=edit`
 * link opens the dialog on the FIRST entry of the session — an entry this hook
 * never pushed, so it carries no stamp, so `close` falls back to a quiet
 * REPLACE and the reader is never walked out of the app. The same fallback
 * covers a stamp that a later Next navigation rebuilt away.
 *
 * ── PERMISSION IS PART OF THE URL CONTRACT ─────────────────────────────────
 * A panel bound at the bottom of the tree opens on the param alone, so without
 * `canOpen` a plain member could reach an admin's prefilled edit form through a
 * copied link — exposure the button-level `canManage &&` gate used to prevent.
 * {@link UrlOverlayOptions.canOpen} moves that gate onto the param itself: a
 * refused value is reported as NO panel and is stripped from the URL with a
 * quiet replace, so the link degrades to the plain screen instead of a dialog
 * that cannot work. Callers pass the SAME `canManage` / `isMember` values their
 * buttons use, so the gate can never drift from the affordance.
 *
 * ── IT ABSORBS `useDialog`'s REMOUNT CONTRACT, PER VALUE ───────────────────
 * A form dialog has two requirements that pull apart: it must stay MOUNTED
 * while closing (or Radix Presence never plays the exit, which the house motion
 * rule forbids) and it must re-derive its fields on every opening (or an edit
 * dialog reopened after a save shows the values it was born with).
 * {@link UrlOverlay.keyFor} resolves both: spread it as the dialog's `key` and
 * every ARRIVAL at that panel is a fresh mount, while every DEPARTURE is the
 * same instance fading out.
 *
 * The counter is PER VALUE, not per param. A single shared counter would let an
 * unrelated panel cut a dialog's exit short — cancel New channel, tap Members
 * inside its ~200ms fade, and a shared key would move, remounting the closing
 * dialog with `open=false` so it vanished in one frame.
 *
 * ── WHAT IT IS DELIBERATELY NOT FOR ────────────────────────────────────────
 * Destructive confirmations stay in local state. A shareable, refresh-surviving
 * link that re-opens "Delete this space?" is an armed trigger, and those dialogs
 * carry error text tied to the last failed attempt, which a restored URL cannot
 * reproduce. Same for dropdown menus, popovers, the reaction picker, the mention
 * autocomplete and the drag-drop veil: a history entry per menu open floods the
 * back stack with things nobody would ever want to return to.
 */

/** The value a plain (unnamed) overlay opens at. */
const OPEN_VALUE = '1';

/** History-state key naming the param whose `show()` pushed the entry. */
const OVERLAY_STAMP_KEY = '__v2Overlay';

/** Radix `open`/`onOpenChange` pair for ONE value of a multi-panel param. */
export interface OverlayBinding {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface UrlOverlayOptions {
  /**
   * Server-render fallback, for a param that also drives IN-TREE markup. Must
   * be derived from the same navigation URL the server rendered.
   */
  ssrValue?: string | null;
  /**
   * Which values this viewer may open. A `boolean` gates the WHOLE param (the
   * shape a single-overlay key wants); a map gates per panel, and a value not
   * in the map is ungated. A refused value is reported as closed AND stripped
   * from the URL.
   *
   * Map lookups use the value's FAMILY — everything before the first `:` — so a
   * panel that names its target (`ai:{uuid}`) is gated by the same key as the
   * list it drills out of (`ai`), and a param whose values are bare uuids
   * (`?game=`, `?list=`) needs no entries at all.
   *
   * PASS `undefined` WHILE THE ANSWER IS UNKNOWN — before the query carrying
   * the viewer's role has landed. Every value is ungated for that window, which
   * is safe because a screen in its pending state renders no panels, and it is
   * what stops a deep link being stripped from an admin who simply arrived
   * before their own roster did.
   */
  canOpen?: boolean | Readonly<Record<string, boolean>>;
}

export interface UrlOverlay {
  /** The live param value, AFTER `canOpen`; `null` = closed. */
  value: string | null;
  /** `value !== null` — Radix's `open` for a single-overlay param. */
  open: boolean;
  /** Open (or re-target) the overlay. Opening a closed param PUSHes one entry. */
  show: (value?: string) => void;
  /** Close it — walks back over this hook's own entry when it pushed one. */
  close: () => void;
  /**
   * Close as part of a MOVE, rewriting the entry instead of popping it.
   *
   * Required whenever the same handler goes on to write the URL — jumping to a
   * message from the pinned sheet, opening a game from the quiz library,
   * landing on a list the create dialog just made, navigating to a new channel.
   * {@link UrlOverlay.close} would schedule a `history.back()` and every one of
   * those writes would land on the entry that pop is about to discard, so the
   * move would be undone the moment the popstate arrived. Dismissal uses
   * `close`; going somewhere uses this.
   */
  closeInPlace: () => void;
  /** Re-target an overlay in place (REPLACE): drilling inside costs no entry. */
  swap: (value: string | null) => void;
  /** Radix's `onOpenChange` exactly, for a param with a single overlay. */
  setOpen: (open: boolean) => void;
  /** Radix props for one panel of a param that carries several. */
  bind: (value: string) => OverlayBinding;
  /** Per-panel remount key. Pass as the dialog's `key`. */
  keyFor: (value?: string) => string;
}

interface OverlayState {
  value: string | null;
  /** Per-value open counters — only the arrived-at value's ever moves. */
  counts: Readonly<Record<string, number>>;
}

/** The live URL's value for `param`; `ssrValue` only where there is no window. */
function readParam(param: string, ssrValue: string | null): string | null {
  if (typeof window === 'undefined') return ssrValue;
  return new URLSearchParams(window.location.search).get(param);
}

/** Apply {@link UrlOverlayOptions.canOpen} to one value. Unknown gate = open. */
function isAllowed(
  gate: UrlOverlayOptions['canOpen'],
  value: string,
): boolean {
  if (gate === undefined) return true;
  if (typeof gate === 'boolean') return gate;
  const colon = value.indexOf(':');
  const family = colon === -1 ? value : value.slice(0, colon);
  return gate[family] !== false;
}

export function useUrlOverlay(
  param: string,
  options: UrlOverlayOptions = {},
): UrlOverlay {
  const { ssrValue = null, canOpen } = options;

  const [state, setState] = useState<OverlayState>(() => ({
    value: readParam(param, ssrValue),
    counts: {},
  }));
  /** A `history.back()` this hook asked for, not yet delivered as a popstate.
   *  Without it a second Cancel — a double tap, or Esc landing in the same
   *  frame — would walk back TWICE off one overlay. */
  const backPendingRef = useRef(false);
  /** The gate, readable from the stable dispatchers below. It is held in a ref
   *  and not a dependency ON PURPOSE: callers build `canOpen` inline from query
   *  data, so depending on its identity would give `show` a new identity every
   *  render — and `show` is a dependency of the channel screen's row callbacks,
   *  whose stability the feed's no-list-rerender discipline rests on. */
  const canOpenRef = useRef(canOpen);
  useEffect(() => {
    canOpenRef.current = canOpen;
  });

  /** The ONE transition. Closing never bumps a counter, so the closing dialog
   *  keeps its instance and plays its exit; arriving anywhere new bumps only
   *  THAT value's, so no other panel's mount is disturbed. */
  const adopt = useCallback((next: string | null) => {
    setState((previous) => {
      if (previous.value === next) return previous;
      if (next === null) return { value: null, counts: previous.counts };
      return {
        value: next,
        counts: { ...previous.counts, [next]: (previous.counts[next] ?? 0) + 1 },
      };
    });
  }, []);

  const rawValue = state.value;
  const refused = rawValue !== null && !isAllowed(canOpen, rawValue);
  /**
   * THE ADDRESS BAR OUTRANKS THIS COMPONENT'S MEMORY, and there is exactly one
   * direction in which they can drift: the refusal effect below strips a param
   * React still remembers. Re-reading the live URL here makes that strip STICK
   * — a gate that later flips back to `true` (an org deleted, a member promoted)
   * then finds nothing to spring open — and it does so without a state write,
   * which an effect is not allowed to make (cascading renders).
   *
   * Every other path already writes the URL and the state in one handler, so
   * this check is inert for all of them. It costs one query-string parse per
   * render, and it is the same read the initialiser and every writer make.
   */
  const stripped = rawValue !== null && readParam(param, rawValue) !== rawValue;
  const value = refused || stripped ? null : rawValue;

  // A refused value cannot simply be ignored: left in the address bar it would
  // survive into the next reload, share or Back and land on the same dead
  // panel. The quiet replace is a correction to an EXTERNAL system (the
  // session history), which is what an effect is for.
  useEffect(() => {
    if (!refused) return;
    quietReplaceUrlParams({ [param]: null });
  }, [param, refused]);

  const show = useCallback(
    (next: string = OPEN_VALUE) => {
      if (!isAllowed(canOpenRef.current, next)) return;
      backPendingRef.current = false;
      adopt(next);
      // The address bar is the truth here, not `state`: it is the value Back
      // will restore, and quiet writes never reach a React snapshot.
      const live = readParam(param, null);
      // IDEMPOTENT. Several affordances open the same panel (a header button, a
      // menu item, an empty state) and any of them can be double-tapped; a
      // second push would mean a second Back press to leave one overlay.
      if (live === next) return;
      if (live !== null) {
        // Already showing something on this param — re-target IN PLACE, so the
        // overlay stays one stop and Back leaves it rather than revealing
        // whichever panel happened to be open before.
        quietReplaceUrlParams({ [param]: next });
        return;
      }
      quietPushUrlParams({ [param]: next }, { [OVERLAY_STAMP_KEY]: param });
    },
    [adopt, param],
  );

  const swap = useCallback(
    (next: string | null) => {
      adopt(next);
      quietReplaceUrlParams({ [param]: next });
    },
    [adopt, param],
  );

  const closeInPlace = useCallback(() => swap(null), [swap]);

  const close = useCallback(() => {
    if (backPendingRef.current) return;
    adopt(null);
    if (readHistoryStamp(OVERLAY_STAMP_KEY) === param) {
      // Our own entry: REMOVE it rather than blank it, so opening and closing a
      // panel leaves the back stack exactly as it found it.
      backPendingRef.current = true;
      window.history.back();
      return;
    }
    // Someone else's entry — a shared link that opened straight into the panel,
    // or a stamp a later Next navigation rebuilt away. Walking back from here
    // would leave the app, so the URL is corrected in place instead.
    quietReplaceUrlParams({ [param]: null });
  }, [adopt, param]);

  const setOpen = useCallback(
    (next: boolean) => {
      if (next) show();
      else close();
    },
    [close, show],
  );

  // Back/Forward is the whole point: adopt whatever the restored entry says.
  // This also settles the `history.back()` above — a close is not complete
  // until the entry it asked for has actually arrived.
  useEffect(() => {
    const onPopState = () => {
      backPendingRef.current = false;
      adopt(readParam(param, null));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [adopt, param]);

  const { counts } = state;

  const bind = useCallback(
    (bound: string): OverlayBinding => ({
      open: value === bound,
      // A controlled Radix overlay only reports `false` for the one that is
      // actually open — a swap closes the previous panel by prop, silently —
      // so an unconditional `close()` here can never shut the wrong thing.
      onOpenChange: (next: boolean) => {
        if (next) show(bound);
        else close();
      },
    }),
    [close, show, value],
  );

  const keyFor = useCallback(
    (bound: string = OPEN_VALUE) => `${bound}#${counts[bound] ?? 0}`,
    [counts],
  );

  return {
    value,
    open: value !== null,
    show,
    close,
    closeInPlace,
    swap,
    setOpen,
    bind,
    keyFor,
  };
}

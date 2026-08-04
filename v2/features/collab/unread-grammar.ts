/**
 * The unread GRAMMAR — the two-tier visual language every collab row speaks,
 * and the one place its vocabulary is defined. Sources: `design-research.md`
 * DIRECTION 2 and `api-digest.md` §D (Ruling A) — 2026-08-04.
 *
 * It lives in the shared collab home rather than in either feature because
 * BOTH derive it: `spaces/model.ts` from a space's §17 rollups, and
 * `channels/model.ts` from a channel's own counts. Keeping the type and the
 * quiet constant here is what lets each row's derivation sit with the row's
 * own feature without one feature importing the other (audit L2).
 */

/**
 * What a row must render:
 *  - `unread`   → the title goes bold AND a small gold dot appears;
 *  - `mentions` → the gold numeric badge, and ONLY mentions are ever a number;
 *  - `muted`    → the row dims and can never go bold, but a direct @you badge
 *                 still shows (mute kills notifications and the unread
 *                 rollup, never a personal mention — Ruling A, exactly).
 *
 * No red anywhere: red is reserved for failure and destructive actions.
 */
export interface UnreadGrammar {
  unread: boolean;
  mentions: number;
  muted: boolean;
}

/** A row with nothing to say — one frozen object so a quiet list of fifty
 *  rows allocates nothing and memoised rows keep their references. */
export const QUIET_GRAMMAR: UnreadGrammar = {
  unread: false,
  mentions: 0,
  muted: false,
};

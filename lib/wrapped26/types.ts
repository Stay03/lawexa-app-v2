/**
 * Lawexa Wrapped 2026, general edition (thread f833c285; Arthur's build kit,
 * data/wrapped-user.schema.json). `GET /wrapped/2026/me` returns this shape,
 * camelCase, and every string is final copy written on the server. The app
 * never words a slide itself: it lays out what it is given.
 *
 * Agreed with Backend on 21 November 2026, beyond the kit's schema:
 * - `slides`: the slide ids to play, in order, skips already applied.
 * - The slide blocks are null when their slide is not in `slides`.
 * - `glowUp.fromLabel`/`toLabel`, `guess.kind`, `physical.kind`,
 *   `coldOpen.kind`, `shareCode`, `shareSignups`.
 */

export type Wrapped26Track = 'undergraduates' | 'lawyers';

/** Every slide of the kit, in story order. */
export const WRAPPED26_SLIDE_IDS = ['00', '01', '02a', '02b', '03', '04', '05', '06', '07', '08', '09a', '09b', '09c', '09d', '10'] as const;

export type Wrapped26SlideId = (typeof WRAPPED26_SLIDE_IDS)[number];

export interface Wrapped26Stat {
  value: string;
  label: string;
}

export interface Wrapped26Record {
  track: Wrapped26Track;
  /** The slides to play, in order (the thin cut and the skips already applied). */
  slides: Wrapped26SlideId[];
  /** Fewer than about 15 active days: the short story. */
  thinData: boolean;
  user: {
    firstName: string;
    avatarUrl: string | null;
    /** Undergraduates: "300L". Null when the profile has none. */
    level?: string | null;
    /** Undergraduates: the school's short name. Null when the profile has none. */
    school?: string | null;
    /** Lawyers. Null when the profile has none. */
    yearOfCall?: number | null;
  };
  coldOpen: {
    /** `night`: a session after 10pm. `busiest`: their biggest day; no time then. */
    kind: 'night' | 'busiest';
    date: string;
    time: string | null;
    ampm: string | null;
    line: string;
  } | null;
  guess: {
    kind: 'cases' | 'authorities' | 'questions';
    question: string;
    /** Exactly three. */
    options: string[];
    actual: number;
    revealLine: string;
  } | null;
  physical: {
    /** `answers`: pages of Lawexa answers they read. */
    kind: 'judgments' | 'answers';
    pages: number;
    stackCount: number;
    line: string;
  } | null;
  firstSearch: {
    topic: string;
    date: string;
    line: string;
  } | null;
  obsession: {
    /** Null, with count 0, when they never searched the same thing twice. */
    topic: string | null;
    count: number;
    line: string;
  } | null;
  busiestDay: {
    month: string;
    day: number;
    daysInMonth: number;
    count: number;
    line: string;
  } | null;
  glowUp: {
    /** Searches a week in the first full active month. */
    january: number;
    /** November's; null on the steady line. */
    december: number | null;
    fromLabel: string;
    toLabel: string;
    /** SVG polyline points in an 888×560 box, fromLabel to toLabel. */
    points: string;
    line: string;
    /** Null on the steady line. */
    endLine: string | null;
  } | null;
  peers: {
    percentile: number;
    group: string;
    line: string;
  } | null;
  casting: {
    question: string;
    /** Exactly three, distinct. */
    audition: Wrapped26Stat[];
  };
  character: {
    /** A name in lib/wrapped26/characters.ts for this track. */
    name: string;
    archetype: string;
    rising: string;
    evidence: string;
  };
  forecast: string;
  cta: {
    share: string;
    invite: string;
  };
  /** Exactly two, for the share card. */
  shareStats: Wrapped26Stat[];
  /** The `wr-XXXXXXXX` code for lawexa.com/wrapped?r=. */
  shareCode: string;
  shareSignups: number;
}

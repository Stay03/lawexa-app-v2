import type { WrappedCampus, WrappedCourseKey, WrappedCourseStatus, WrappedGaniFigure, WrappedPersonaKey } from './types';

/**
 * The words of Lawexa Wrapped, Bar Finals edition, as data (Arthur's spec, 10
 * October 2026: "slide definitions, copy banks and vibe banks are data, not
 * code", so the 1 December edition swaps the banks, not the screens). The vibe
 * lines, statuses, campaign line and persona names are Arthur's, or agreed with
 * him in thread f833c285 on 4 November, the persona one-liners and campus
 * props included (approved by the techlead and Arthur, 4 November).
 * Results are not out when this ships: nothing here judges, grades or predicts.
 */

/** The campaign line. Keep the wording and the full stops exactly. */
export const CAMPAIGN_LINE = ['The Law.', 'The Bar.', 'The Bench.'] as const;

export const WRAPPED_URL = 'lawexa.com/wrapped';

export const CAMPUS_NAMES: Record<WrappedCampus, string> = {
  lagos: 'Lagos',
  abuja: 'Abuja',
  enugu: 'Enugu',
  port_harcourt: 'Port Harcourt',
  bayelsa: 'Bayelsa',
  kano: 'Kano',
  yola: 'Yola',
};

/** The report slip's course names, in the slip's fixed order. */
export const COURSE_NAMES: Record<WrappedCourseKey, string> = {
  civil_litigation: 'Civil Litigation',
  criminal_litigation: 'Criminal Litigation',
  corporate_law_practice: 'Corporate Law Practice',
  property_law_practice: 'Property Law Practice',
  professional_ethics: 'Professional Ethics and Skills',
};

/** A relationship, never a grade: the most-read course is "Married". */
export const STATUS_LABELS: Record<WrappedCourseStatus, string> = {
  married: 'Married',
  best_friends: 'Best friends',
  situationship: 'Situationship',
  its_complicated: "It's complicated",
  talking_stage: 'Talking stage',
};

export const PERSONAS: Record<WrappedPersonaKey, { name: string; line: string }> = {
  section_quoter: { name: 'The Section Quoter', line: 'You read the statute before anyone asked.' },
  overnight_scholar: { name: 'The Overnight Scholar', line: 'The night shift was your shift.' },
  case_law_collector: { name: 'The Case Law Collector', line: 'Every judgment, opened and kept.' },
  drafting_don: { name: 'The Drafting Don', line: 'Drafts on drafts. Light work.' },
  last_minute_lord: { name: 'The Last-Minute Lord', line: 'Pressure? You call it a deadline.' },
  steady_learned_friend: { name: 'The Steady Learned Friend', line: 'Small small, every day. You no gree.' },
};

/** The order the other personas are named in, under the student's own. */
export const PERSONA_ORDER: readonly WrappedPersonaKey[] = [
  'section_quoter',
  'overnight_scholar',
  'case_law_collector',
  'drafting_don',
  'last_minute_lord',
  'steady_learned_friend',
];

export const GANI_FIGURES: Record<WrappedGaniFigure, string> = {
  gani_fawehinmi: 'Gani',
  fra_williams: 'FRA Williams',
  to_elias: 'T.O. Elias',
  lord_denning: 'Lord Denning',
};

export type VibeColour = 'gold' | 'lilac' | 'coral' | 'lime';

export interface Vibe {
  id: number;
  line: string;
  /** What the face card acts out, in words: the picture's alt text (the art is Arthur's prop-NN). */
  prop: string;
  /** The card's background (Arthur's manifest). */
  colour: VibeColour;
  /** The circle behind the face in the polaroid (manifest; 'paper' is cream). */
  circle: VibeColour | 'paper';
  /** Shown only to that campus. */
  campus?: WrappedCampus;
}

/** Accent and circle per card, 1 to 37, from Arthur's manifest.json (4 November 2026). */
const CARD_COLOURS: readonly (readonly [VibeColour, VibeColour | 'paper'])[] = [
  ['lilac', 'gold'], ['coral', 'paper'], ['lime', 'gold'], ['gold', 'lilac'], ['lilac', 'lime'],
  ['coral', 'gold'], ['gold', 'coral'], ['lime', 'lilac'], ['lilac', 'gold'], ['coral', 'lime'],
  ['gold', 'lilac'], ['lime', 'coral'], ['lilac', 'lime'], ['gold', 'paper'], ['coral', 'gold'],
  ['lime', 'coral'], ['gold', 'lilac'], ['lilac', 'gold'], ['coral', 'lilac'], ['lime', 'gold'],
  ['gold', 'coral'], ['lilac', 'coral'], ['coral', 'lime'], ['lime', 'gold'], ['gold', 'lime'],
  ['lilac', 'gold'], ['coral', 'paper'], ['lime', 'lilac'], ['gold', 'coral'], ['lilac', 'lime'],
  ['coral', 'gold'], ['lime', 'lilac'], ['gold', 'lime'], ['lilac', 'coral'], ['coral', 'lime'],
  ['lime', 'gold'], ['gold', 'lilac'],
];

const LINES: readonly (readonly [string, string, WrappedCampus?])[] = [
  ['No rage bait me.', 'Raised palm, "ABEG, NO."'],
  ["NLS didn't take my life.", 'Flexing arm'],
  ['Any book I read now na billboard.', 'Civil Lit billboard'],
  ['Mr Barry, the time is now oo.', 'Clock'],
  ['I am active for enjoyment.', 'ACTIVE badge'],
  ['The CTB pictures go bang.', 'Camera with flash'],
  ['Mama, I made it.', 'Happy tears, MAMA heart'],
  ['Mrs Barrister will fit me? Forget!', 'Gold crown'],
  ['Corporate Law Practice cooperated, las las.', 'Briefcase'],
  ['NLS, see you no more.', 'Waving hand'],
  ['Pass the mic to the latest Esquire!', 'Microphone'],
  ['I chop this paper like BOB dinner.', 'Plate of jollof'],
  ['No more panic attacks, puhleaseeeee!', 'Cold drink, CHILL MODE'],
  ['Esq. loading…', 'Loading bar 99%'],
  ['Learned friend, reporting for enjoyment.', 'Party hat, confetti'],
  ['Black and white don rest.', 'Colourful outfit'],
  ['Wig and gown, I dey come.', 'Speed lines to CTB'],
  ['My Lord, I so humbly submit: I am done.', "Speech bubble I'M DONE"],
  ['Overnight era is officially over.', 'Crossed-out moon'],
  ['Mosquitoes, una don lose your customer.', 'Crossed-out mosquito'],
  ['Bar Finals said hi. I said bye.', 'Waving hand'],
  ['Most obliged, NLS. Most obliged.', 'Speech bubble OBLIGED!'],
  ['Sapa can wait. Call to Bar first.', 'Naira notes'],
  ['Next time you see me, na Barrister.', 'BARRISTER nameplate'],
  ['Property Law Practice? I own the property now.', 'House, C OF O: MINE'],
  ['Section 84 still dey my head. Rent free.', 'Speech bubble S. 84'],
  ['Five papers. Zero regrets. Okay, small regrets.', 'Sweat drop, 5/5 PAPERS'],
  ['From Bwari to bar-ready.', 'Suitcase', 'abuja'],
  ['Civ Lit, you tried. I tried harder.', 'Trophy'],
  ['Revision week done. Enjoyment week loading.', 'Loading bar 74%'],
  // 31 to 37: one line per campus (thread f833c285, 4 November). 38 is spare.
  ['Eko o ni baje. My wig no go spoil too.', 'Wig with an ÈKÓ tag', 'lagos'],
  ['Agbani tested my patience. Bar Finals no fit.', 'Keke', 'enugu'],
  ['Oil City finalist. Five papers, well oiled.', 'Oil drop', 'port_harcourt'],
  ['Yenagoa to the wig, no paddle needed.', 'Canoe paddle', 'bayelsa'],
  ['Bar Finals dry me like kilishi. Still spicy.', 'Pack of kilishi', 'kano'],
  ['Yola heat prepared me. Exam hall no fit burn me.', 'Hand fan', 'yola'],
  ['Wike dey build flyover. I dey build Esq.', 'Hard hat', 'abuja'],
];

/** Vibes 1 to 37, keyed by the id Backend picks, with the card colours from Arthur's manifest. */
export const VIBES: ReadonlyMap<number, Vibe> = new Map(
  LINES.map(([line, prop, campus], index) => {
    const id = index + 1;
    const [colour, circle] = CARD_COLOURS[index];
    return [id, { id, line, prop, colour, circle, ...(campus ? { campus } : {}) }];
  }),
);

/** The vibe for an id, or vibe 1 (the main card) for an id the app does not know yet (38 is spare). */
export function vibeFor(id: number): Vibe {
  return VIBES.get(id) ?? (VIBES.get(1) as Vibe);
}

/** "9,999+" past the cap, commas below it; never an invented number. */
export const DISPLAY_CAP = 9999;

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const whole = Math.max(0, Math.round(value));
  return whole > DISPLAY_CAP ? `${DISPLAY_CAP.toLocaleString('en-NG')}+` : whole.toLocaleString('en-NG');
}

/** "1.2 million", "86,400": words keep their size, since the card is about how much. */
export function formatWords(value: number): string {
  if (value >= 1_000_000) return `${(Math.round(value / 100_000) / 10).toLocaleString('en-NG')} million`;
  return Math.round(value).toLocaleString('en-NG');
}

/** "3:47 am" from "03:47" (WAT). */
export function formatClock(hhmm: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return hhmm;
  const hour = Number(match[1]);
  const suffix = hour < 12 ? 'am' : 'pm';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${match[2]} ${suffix}`;
}

/** "3rd", "11th". */
export function ordinal(value: number): string {
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return `${value}th`;
  return `${value}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[value % 10] ?? 'th'}`;
}

/** "Ada O." on the share card: first name and last initial only (NDPA 2023). */
export function shareName(firstName: string, lastInitial: string | null): string {
  const first = firstName.trim().slice(0, 14);
  return lastInitial ? `${first} ${lastInitial.trim().charAt(0).toUpperCase()}.` : first;
}

/** The link a share carries, so sign-ups count per sharer. */
export function shareUrl(code: string | null | undefined, origin = 'https://lawexa.com'): string {
  const base = `${origin.replace(/\/$/, '')}/wrapped`;
  return code ? `${base}?r=${encodeURIComponent(code)}` : base;
}

/**
 * The persona's one-line reason, from Backend's {metric, value}. A metric the
 * app has no sentence for shows no reason line: never a guessed sentence.
 */
const REASONS: Record<string, (value: string) => string> = {
  // Backend's keys (thread f833c285, 4 November): statute_share_pct, overnight_share_pct,
  // case_share_pct, drafts, last_minute_share_pct. The rest are fallbacks.
  statute_share_pct: (v) => `Statutes made up ${v}% of your reading.`,
  case_share_pct: (v) => `Cases made up ${v}% of your reading.`,
  statutes_read: (v) => `You opened ${v} statutes.`,
  sections_highlighted: (v) => `You highlighted ${v} sections.`,
  overnight_share_pct: (v) => `${v}% of your study days ran past midnight.`,
  overnights: (v) => `${v} nights on Lawexa after midnight.`,
  cases_opened: (v) => `You opened ${v} cases.`,
  judgments_read: (v) => `You read ${v} judgments.`,
  bookmarks: (v) => `You kept ${v} cases for later.`,
  drafts: (v) => `Lawexa drafted ${v} times for you.`,
  words_written: (v) => `Lawexa wrote ${v} words for you.`,
  last_minute_share_pct: (v) => `${v}% of your study days came in the last three weeks.`,
  days_active: (v) => `You showed up on ${v} days.`,
};

export function personaReason(reason: { metric: string; value: number } | null | undefined): string | null {
  if (!reason) return null;
  const sentence = REASONS[reason.metric];
  return sentence ? sentence(formatCount(reason.value)) : null;
}

/** "You read more judgments than 94% of students on Lawexa." Only for a metric with a noun; else no line. */
const PERCENTILE_NOUNS: Record<string, string> = {
  judgments_read: 'judgments',
  cases_opened: 'cases',
  statutes_read: 'statutes',
  sections_highlighted: 'sections',
  quiz_answers: 'quiz questions',
};

export function percentileLine(percentile: { metric: string; value: number } | null | undefined): string | null {
  if (!percentile) return null;
  const noun = PERCENTILE_NOUNS[percentile.metric];
  const value = Math.round(percentile.value);
  if (!noun || value <= 0 || value >= 100) return null;
  return `You read more ${noun} than ${value}% of students on Lawexa.`;
}

/** The three stat stickers' labels, by Backend's sticker key; an unknown key shows its value alone. */
export const STICKER_LABELS: Record<string, string> = {
  overnights: 'overnights',
  total_hours: 'hours on Lawexa',
  judgments_read: 'judgments read',
  law_report_pages: 'pages of law reports',
  longest_streak: 'day streak',
  days_active: 'days studied',
  words_written: 'words Lawexa wrote',
  mocks_answered: 'mock questions',
  best_mock_pct: '% best mock',
  revision_week_days: 'of 5 revision days',
};

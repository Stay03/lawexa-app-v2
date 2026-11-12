import { ordinal, shareName } from '@/lib/wrapped/copy';

/**
 * The live quiz's result card: Arthur's share card, one per place, as a
 * story (1080 × 1920) and a square (1080 × 1080) (Arthur, f9645a22, 12
 * November 2026: "I have attached the suitable cards"). His files are the
 * reference: every word and every number on the card comes from them, and
 * `result-card-layout.ts` holds where each thing sits.
 *
 * This file is the card's words: the headline for the place, the line that
 * says who placed where, the three stats, and the line over the button. The
 * name is first name and last initial ("Ada H."), as on Arthur's cards and
 * Wrapped's. Pure, so a test pins it.
 */

export interface ResultCardInput {
  playerName: string;
  /** The player's photo, when they have one; the gold circle shows their initials when not. */
  avatarUrl: string | null;
  rank: number;
  score: number;
  correctCount: number;
  /** Questions the player could answer: fewer than the quiz's for a late joiner. */
  answerableCount: number;
  quizTitle: string;
  /** The Space the game was played in, for the share words; left out when unknown. */
  spaceName: string | null;
  playerCount: number;
}

export type CardFormat = 'story' | 'square';

export const CARD_FORMATS: readonly CardFormat[] = ['story', 'square'];

/**
 * The card's colour for a place: gold, silver and bronze for the podium, grey
 * for the rest of the top 10, a darker grey past it (Arthur's podium block).
 */
export type CardTier = 'gold' | 'silver' | 'bronze' | 'top10' | 'field';

export function cardTier(rank: number): CardTier {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return rank <= 10 ? 'top10' : 'field';
}

/** Arthur's headline for each place, in his two lines, word for word. */
const HEADLINES: Readonly<Record<number, readonly [string, string]>> = {
  1: ['Gold,', 'my lord.'],
  2: ['Silver,', 'my lord.'],
  3: ['Bronze,', 'my lord.'],
  4: ['Just off', 'the podium.'],
  5: ['Top five.', 'No objection.'],
  6: ['Motion', 'granted.'],
  7: ['Top 10.', 'Sustained.'],
  8: ['On the', 'record.'],
  9: ['Leave', 'granted.'],
  10: ['Last seat', 'at the Bar.'],
};

const OUTSIDE_TOP_10: readonly [string, string] = ['Adjourned,', 'not dismissed.'];

/** The headline's two lines for a place; every place past 10th shares Arthur's "outside top 10" card. */
export function cardHeadline(rank: number): readonly [string, string] {
  return HEADLINES[rank] ?? OUTSIDE_TOP_10;
}

/**
 * "Top N% of players": the share of the room at or above the player's place,
 * rounded up, so first of 70 is the top 2% and no one is the top 0%. Every
 * one of Arthur's cards follows it (1st of 70 is 2%, 4th is 6%, 7th is 10%,
 * 23rd is 33%).
 */
export function topPercent(rank: number, playerCount: number): number {
  const players = Math.max(playerCount, rank, 1);
  return Math.min(100, Math.max(1, Math.ceil((rank / players) * 100)));
}

/** The line over the button: a dare in the top 10, a see-you-later past it. */
export function cardCta(rank: number): string {
  return rank <= 10 ? 'Think you can beat me?' : 'See you next sitting.';
}

/** The points' unit: "pt" for one, "pts" otherwise (the game's own score rows). */
export function pointsUnit(score: number): string {
  return score === 1 ? 'pt' : 'pts';
}

/** Points as the game shows them, with the unit. */
export function pointsText(score: number): string {
  return `${score.toLocaleString('en-US')} ${pointsUnit(score)}`;
}

/** "Ada Hassan" → "Ada H.": first name and last initial, the rule for a name on a public picture. */
export function cardName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  return shareName(words[0], words.length > 1 ? words[words.length - 1] : null);
}

/** The player's initials, for the gold circle when there is no photo. */
export function cardInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = [...words[0]][0] ?? '';
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/** The line under the headline, in two parts so a long quiz title can be shortened on its own. */
export function cardSubline(input: ResultCardInput): { lead: string; title: string } {
  const lead = `${cardName(input.playerName)} placed ${ordinal(input.rank)} of ${input.playerCount.toLocaleString('en-US')} in`;
  return { lead, title: input.quizTitle.trim().replace(/\s+/g, ' ') };
}

export interface CardStat {
  value: string;
  label: string;
}

/** The three stats on the band: points, right answers out of the player's questions, and the top share. */
export function cardStats(input: ResultCardInput): [CardStat, CardStat, CardStat] {
  return [
    { value: input.score.toLocaleString('en-US'), label: input.score === 1 ? 'point' : 'points' },
    { value: `${input.correctCount}/${input.answerableCount}`, label: 'correct' },
    { value: `Top ${topPercent(input.rank, input.playerCount)}%`, label: 'of players' },
  ];
}

/** The card's words for the page and the share sheet. Pure, so a test pins it. */
export function resultCardCopy(
  input: ResultCardInput,
  format: CardFormat,
): {
  place: string;
  alt: string;
  shareText: string;
  fileName: string;
} {
  const place = ordinal(input.rank);
  const { lead, title } = cardSubline(input);
  const stats = cardStats(input)
    .map((stat) => `${stat.value} ${stat.label}`)
    .join(', ');
  return {
    place,
    alt: `${cardHeadline(input.rank).join(' ')} ${lead} ${title}. ${stats}.`,
    shareText: `${lead} ${title}${input.spaceName ? `, ${input.spaceName}` : ''}. ${cardCta(input.rank)} Play the live quiz on Lawexa.`,
    fileName: `lawexa-quiz-${place}-${format}.png`,
  };
}

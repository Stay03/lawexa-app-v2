import { CAMPAIGN_LINE, formatCount, ordinal, shareName } from '@/lib/wrapped/copy';
import type { PosterContent } from '@/lib/wrapped/share-image';
import { VIBE_BACKGROUNDS } from '@/lib/wrapped/theme';

/**
 * The live quiz's result card: one player's finish as Wrapped's poster
 * (Arthur, f730f71c, 11 November 2026: "a shareable card just like we did
 * for the Wrapped"; and at 23:31, turning down a card of its own design).
 *
 * It is Wrapped's card, not a likeness of it: Arthur's frame art, layout and
 * type, drawn by the same `drawPoster` (`lib/wrapped/share-image.ts`) on the
 * phone, shared and saved the same way (`lib/share-card/canvas.ts`). Only the
 * words change: the place and the quiz where the vibe line was, the player
 * in the polaroid, three stat stickers from the game, and a sticker for the
 * podium where the persona was. The name is first name and last initial,
 * as Wrapped prints it.
 */

export interface ResultCardRow {
  rank: number;
  name: string;
  score: number;
  isViewer: boolean;
}

export interface ResultCardInput {
  playerName: string;
  /** The player's photo, when they have one; their place stands in the polaroid when not. */
  avatarUrl: string | null;
  rank: number;
  score: number;
  correctCount: number;
  /** Questions the player could answer: fewer than the quiz's for a late joiner. */
  answerableCount: number;
  quizTitle: string;
  /** The Space the game was played in; left out when unknown. */
  spaceName: string | null;
  playerCount: number;
  /** The top three, best first (the share text's own leader line). */
  podium: ResultCardRow[];
}

/** The points' unit: "pt" for one, "pts" otherwise (the card and the ranking both). */
export function pointsUnit(score: number): string {
  return score === 1 ? 'pt' : 'pts';
}

/** Points as the game shows them, with the unit. */
export function pointsText(score: number): string {
  return `${score.toLocaleString('en-US')} ${pointsUnit(score)}`;
}

/** "Ada Obi" → "Ada O.": Wrapped's rule for a name on a public picture. */
export function cardName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  return shareName(words[0], words.length > 1 ? words[words.length - 1] : null);
}

/**
 * The frame by place, from Arthur's Wrapped frames: first on the gold ground,
 * second on lilac, third on coral, everyone else on lime. Each is a frame
 * whose circle is a different colour from its ground, so a place in the
 * circle always stands out.
 */
export function resultFrame(rank: number): { vibeId: number; colour: keyof typeof VIBE_BACKGROUNDS } {
  if (rank === 1) return { vibeId: 4, colour: 'gold' };
  if (rank === 2) return { vibeId: 1, colour: 'lilac' };
  if (rank === 3) return { vibeId: 6, colour: 'coral' };
  return { vibeId: 3, colour: 'lime' };
}

/** The turned sticker on the polaroid, where Wrapped puts the persona. */
export function resultBanner(rank: number): string {
  if (rank === 1) return 'Quiz Champion';
  if (rank <= 3) return 'Made the Podium';
  return 'Took the Challenge';
}

/** The card's words, and the words that go with it to the share sheet. Pure, so a test pins it. */
export function resultCardCopy(input: ResultCardInput): {
  place: string;
  headline: string;
  shareText: string;
  fileName: string;
} {
  const place = ordinal(input.rank);
  const headline = `${cardName(input.playerName)} came ${place} in ${input.quizTitle}`;
  return {
    place,
    headline,
    shareText: `${headline}, ${pointsText(input.score)}${input.spaceName ? `, ${input.spaceName}` : ''}. Live quiz on Lawexa.`,
    fileName: `lawexa-quiz-${place}.png`,
  };
}

/** The poster's content for a player's finish. Pure, so a test pins it. */
export function resultPoster(input: ResultCardInput): PosterContent {
  const place = ordinal(input.rank);
  return {
    background: VIBE_BACKGROUNDS[resultFrame(input.rank).colour],
    kicker: input.spaceName ? `LIVE QUIZ · ${input.spaceName.toUpperCase()}` : 'LIVE QUIZ',
    line: `Came ${place} in ${input.quizTitle}`,
    caption: { name: cardName(input.playerName), sub: input.spaceName },
    mark: place,
    banner: resultBanner(input.rank),
    stickers: [
      // Not `formatCount`: its 9,999+ cap suits Wrapped's counts, and a game's points run past it.
      { value: input.score.toLocaleString('en-US'), label: input.score === 1 ? 'point' : 'points' },
      { value: place, label: `of ${formatCount(input.playerCount)} ${input.playerCount === 1 ? 'player' : 'players'}` },
      { value: `${input.correctCount}/${input.answerableCount}`, label: 'right answers' },
    ],
    campaign: CAMPAIGN_LINE,
    link: 'PLAY LIVE QUIZZES · LAWEXA.COM',
  };
}

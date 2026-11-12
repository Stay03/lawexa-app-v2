import type { CardFormat, CardTier } from './result-card';

/**
 * Where everything on the live quiz's result card sits, in the card's own
 * pixels, read from Arthur's files (`lawexa-share-cards-all.pdf`, 12 November
 * 2026): the story is 1080 × 1920 and the square 1080 × 1080. Nothing here is
 * eyeballed. Positions, sizes, colours and letter spacing are the numbers in
 * his PDF, and the picture tests compare the drawn card with his PNG for
 * every place.
 *
 * His type is Bricolage Grotesque ExtraBold for the headline, the place and
 * the numbers, and DM Sans for everything else, both at their 14 pt optical
 * size (`result-card-fonts.ts`). Letter spacing is in em, as he set it.
 */

export const CARD_COLOURS = {
  ground: '#0a0a0a',
  rays: '#171717',
  band: '#141414',
  rule: '#2c2c2e',
  white: '#ffffff',
  subline: '#a1a1a6',
  label: '#8e8e93',
  gold: '#d19a14',
  goldLip: '#7a5608',
  goldInk: '#1c1405',
  photoGround: '#d3af37',
  medalInk: '#171307',
  logoDisc: '#171307',
  ribbonLeft: '#93abdf',
  ribbonRight: '#d19a14',
} as const;

/** The podium block's colours: its lighter top face, then its front from top to bottom. */
export const PODIUM_COLOURS: Record<CardTier, { top: string; from: string; to: string }> = {
  gold: { top: '#f5d77e', from: '#e8b83a', to: '#8c6b1c' },
  silver: { top: '#c6d5f7', from: '#93abdf', to: '#3b4b72' },
  bronze: { top: '#f9cdb7', from: '#e3956f', to: '#7c4d3b' },
  top10: { top: '#8e8e93', from: '#5a5a60', to: '#2a2a2e' },
  field: { top: '#636366', from: '#3a3a3e', to: '#1f1f22' },
};

/** The medal on the podium for 1st to 3rd: its face, its outer rim and its inner ring. */
export const MEDAL_COLOURS: Record<'gold' | 'silver' | 'bronze', { face: string; rim: string; ring: string }> = {
  gold: { face: '#f7d774', rim: '#b8860b', ring: '#e0b84a' },
  silver: { face: '#e3e6ee', rim: '#9aa0ae', ring: '#c4c8d2' },
  bronze: { face: '#e9a07a', rim: '#9c5a3c', ring: '#c77e5a' },
};

/**
 * Letter spacing, in em, from the glyph positions in Arthur's PDF: the
 * headline and the place are set tight; every other text has none.
 */
export const TRACKING = {
  headline: -0.03,
  place: -0.04,
  none: 0,
} as const;

/** One headline's size and its two baselines; on the square, also where the line under it starts. */
export interface HeadlineSetting {
  size: number;
  baselines: readonly [number, number];
}

/**
 * Each place's headline setting, as Arthur set it: the story shrinks only the
 * two longest headlines, the square sizes each one to its column. Places past
 * 10th share the "outside top 10" setting (key 11).
 */
const STORY_140: HeadlineSetting = { size: 140, baselines: [472, 605] };

const STORY_HEADLINES: Readonly<Record<number, HeadlineSetting>> = {
  1: STORY_140,
  2: STORY_140,
  3: STORY_140,
  4: STORY_140,
  5: { size: 128, baselines: [462, 584] },
  6: STORY_140,
  7: STORY_140,
  8: STORY_140,
  9: STORY_140,
  10: STORY_140,
  11: { size: 119, baselines: [456, 569] },
};

const SQUARE_88 = { size: 88, baselines: [270, 354], sublineTop: 425 } as const;
const SQUARE_68 = { size: 68, baselines: [254, 319], sublineTop: 387 } as const;

const SQUARE_HEADLINES: Readonly<Record<number, HeadlineSetting & { sublineTop: number }>> = {
  1: SQUARE_88,
  2: SQUARE_88,
  3: SQUARE_88,
  4: SQUARE_68,
  5: { size: 57, baselines: [246, 300], sublineTop: 366 },
  6: SQUARE_88,
  7: { size: 74, baselines: [259, 329], sublineTop: 399 },
  8: SQUARE_88,
  9: SQUARE_88,
  10: SQUARE_68,
  11: { size: 53, baselines: [242, 292], sublineTop: 359 },
};

const settingKey = (rank: number) => (rank >= 1 && rank <= 10 ? rank : 11);

export interface CardLayout {
  width: number;
  height: number;
  /** The light rays: 18 wedges of 9°, one every 20°, from the photo's centre. */
  rays: { cx: number; cy: number; radius: number };
  /** The stats band, from `top` to the bottom, under a 4 px rule. */
  bandTop: number;
  photo: { cx: number; cy: number; r: number };
  /** The crown for 1st, drawn in a 96 × 56 box at `scale`. */
  crown: { x: number; y: number; scale: number };
  /** The medal for 1st to 3rd, drawn in a 140 × 190 box at `scale`. */
  medal: { x: number; y: number; scale: number };
  /** The "Top 10" pill for 4th to 10th: the trophy's 24-unit icon at `iconScale`, then the words. */
  badge: { x: number; y: number; w: number; h: number; lip: number; iconScale: number; gap: number; size: number; baseline: number };
  podium: {
    left: number;
    top: number;
    width: number;
    /** The top face: `bevel` deep, its back edge `inset` in from each side. */
    bevel: number;
    inset: number;
    bottom: number;
    place: { cx: number; baseline: number; size: number; maxWidth: number };
  };
  /** The Lawexa mark (a 96-unit drawing at `size`) and "Lawexa live quiz" beside it. */
  brand: { align: 'center' | 'left'; x: number; top: number; size: number; gap: number; textSize: number; baseline: number };
  headline: { align: 'center' | 'left'; x: number };
  subline: { align: 'center' | 'left'; x: number; size: number; minSize: number; maxWidth: number; lineHeight: number; lastBaseline: number };
  cta: { align: 'center' | 'left'; x: number; size: number; baseline: number };
  button: { x: number; y: number; w: number; h: number; r: number; lip: number; size: number; baseline: number };
  stats: { centres: readonly [number, number, number]; maxWidth: number; valueSize: number; valueBaseline: number; labelSize: number; labelBaseline: number };
}

export const CARD_LAYOUTS: Record<CardFormat, CardLayout> = {
  story: {
    width: 1080,
    height: 1920,
    rays: { cx: 540, cy: 890, radius: 1600 },
    bandTop: 1320,
    photo: { cx: 540, cy: 890, r: 150 },
    crown: { x: 492, y: 692, scale: 1 },
    medal: { x: 485, y: 940.357, scale: 11 / 14 },
    badge: { x: 450, y: 1006, w: 180, h: 58, lip: 5, iconScale: 1.25, gap: 10, size: 30, baseline: 1045 },
    podium: { left: 270, top: 1040, width: 540, bevel: 20, inset: 30, bottom: 1320, place: { cx: 540, baseline: 1244, size: 170, maxWidth: 500 } },
    brand: { align: 'center', x: 540, top: 270, size: 60, gap: 16, textSize: 30, baseline: 310 },
    headline: { align: 'center', x: 540 },
    subline: { align: 'center', x: 540, size: 36, minSize: 28, maxWidth: 920, lineHeight: 0, lastBaseline: 685 },
    cta: { align: 'center', x: 540, size: 34, baseline: 1539 },
    button: { x: 338, y: 1567, w: 404, h: 78, r: 28, lip: 8, size: 34, baseline: 1617 },
    stats: { centres: [228, 540, 852], maxWidth: 296, valueSize: 64, valueBaseline: 1425, labelSize: 28, labelBaseline: 1470 },
  },
  square: {
    width: 1080,
    height: 1080,
    rays: { cx: 330, cy: 430, radius: 1300 },
    bandTop: 800,
    photo: { cx: 330, cy: 430, r: 130 },
    crown: { x: 294, y: 256, scale: 0.75 },
    medal: { x: 285, y: 517, scale: 9 / 14 },
    badge: { x: 256, y: 534, w: 148, h: 46, lip: 5, iconScale: 1, gap: 10, size: 24, baseline: 565 },
    podium: { left: 120, top: 560, width: 420, bevel: 16, inset: 25, bottom: 800, place: { cx: 330, baseline: 751, size: 140, maxWidth: 390 } },
    brand: { align: 'left', x: 600, top: 110, size: 52, gap: 14, textSize: 26, baseline: 144 },
    headline: { align: 'left', x: 600 },
    // Lines 39 px apart, as Arthur's two; at most as many as stay clear of the line over the button.
    subline: { align: 'left', x: 600, size: 30, minSize: 30, maxWidth: 400, lineHeight: 39, lastBaseline: 491 },
    cta: { align: 'left', x: 600, size: 30, baseline: 540 },
    button: { x: 600, y: 564, w: 355, h: 70, r: 24, lip: 7, size: 30, baseline: 609 },
    stats: { centres: [228, 540, 852], maxWidth: 296, valueSize: 56, valueBaseline: 902, labelSize: 26, labelBaseline: 944 },
  },
};

/** The headline's size and baselines for a place, and on the square where the line under it starts. */
export function headlineSetting(format: CardFormat, rank: number): HeadlineSetting & { sublineTop: number } {
  if (format === 'story') {
    return { ...STORY_HEADLINES[settingKey(rank)], sublineTop: CARD_LAYOUTS.story.subline.lastBaseline };
  }
  return SQUARE_HEADLINES[settingKey(rank)];
}

/** A text's width as drawn: the font's own advance plus the letter spacing after every character. */
export type Measure = (text: string, font: string) => number;

export function trackedWidth(text: string, font: string, size: number, tracking: number, measure: Measure): number {
  return measure(text, font) + [...text].length * tracking * size;
}

/** Ends a text with "…" at the longest length that fits. */
export function ellipsize(text: string, fits: (candidate: string) => boolean): string {
  if (fits(text)) return text;
  const chars = [...text];
  for (let n = chars.length - 1; n > 0; n -= 1) {
    const candidate = `${chars.slice(0, n).join('').trimEnd()}…`;
    if (fits(candidate)) return candidate;
  }
  return '…';
}

export const DISPLAY_FAMILY = 'Lawexa Card Display';
export const TEXT_FAMILY = 'Lawexa Card Text';

export const displayFont = (size: number) => `800 ${size}px "${DISPLAY_FAMILY}"`;
export const textFont = (weight: 500 | 700, size: number) => `${weight} ${size}px "${TEXT_FAMILY}"`;

/**
 * The line under the headline, laid out. On the story it is one centred line:
 * a long one steps down from 36 px to 28 px, then the quiz title ends with
 * "…" (the crown sits right under it). On the square it wraps in its column,
 * as Arthur's does after "in", onto as many lines as stay clear of the line
 * over the button, the last ending with "…" if the title runs on.
 */
export function sublineLines(
  lead: string,
  title: string,
  format: CardFormat,
  rank: number,
  measure: Measure,
): { size: number; lines: { text: string; baseline: number }[] } {
  const box = CARD_LAYOUTS[format].subline;
  const width = (text: string, size: number) => measure(text, textFont(500, size));
  const whole = title ? `${lead} ${title}` : lead;

  if (format === 'story') {
    for (let size = box.size; size >= box.minSize; size -= 1) {
      if (width(whole, size) <= box.maxWidth) return { size, lines: [{ text: whole, baseline: box.lastBaseline }] };
    }
    const size = box.minSize;
    const text = ellipsize(whole, (candidate) => width(candidate, size) <= box.maxWidth);
    return { size, lines: [{ text, baseline: box.lastBaseline }] };
  }

  const first = headlineSetting('square', rank).sublineTop;
  const maxLines = Math.max(1, Math.floor((box.lastBaseline - first) / box.lineHeight) + 1);
  const words = whole.split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (!line || width(next, box.size) <= box.maxWidth) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  const kept = lines.slice(0, maxLines);
  const last = kept.length - 1;
  const cut = lines.length > maxLines;
  kept[last] = ellipsize(cut ? `${kept[last]} ${lines[maxLines]}` : kept[last], (candidate) => width(candidate, box.size) <= box.maxWidth);
  if (cut && !kept[last].endsWith('…')) kept[last] = `${kept[last]}…`;
  // A single word wider than the column (a very long name) is shortened on its own line too.
  const fitted = kept.map((text) => ellipsize(text, (candidate) => width(candidate, box.size) <= box.maxWidth));
  return { size: box.size, lines: fitted.map((text, index) => ({ text, baseline: first + index * box.lineHeight })) };
}

/** The largest size, up to `size`, at which a text fits `maxWidth` (the place and the stats). */
export function fittedSize(text: string, font: (size: number) => string, size: number, tracking: number, maxWidth: number, measure: Measure): number {
  let fitted = size;
  while (fitted > size / 2 && trackedWidth(text, font(fitted), fitted, tracking, measure) > maxWidth) fitted -= 1;
  return fitted;
}

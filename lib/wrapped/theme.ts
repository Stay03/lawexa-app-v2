import type { VibeColour } from './copy';

/**
 * Lawexa Wrapped's design system, from Arthur's handoff (lawexa-wrapped-tokens,
 * 4 November 2026): the palette, the Paper and Ink surfaces, the accents, and
 * the frame. One set of values for the story screens (as CSS variables, set
 * in app/wrapped/layout.tsx) and the share image (canvas), so the PNG matches
 * what the student saw. Change a value here and nowhere else.
 */
export const WRAPPED_COLOURS = {
  white: '#FFFFFF',
  cream: '#F3ECD9', // cream-100, the Paper surface
  creamLight: '#F8F2E2', // cream-50
  ink: '#171307', // ink-900
  inkRaised: '#3C3627', // ink-700, the Ink theme's raised surface
  inkMuted: '#615B4D', // ink-500, muted text on Paper (5.7:1)
  inkSoft: '#9B9485', // ink-300, muted text on Ink (6.1:1)
  gold: '#D3AF37', // gold-500
  goldDeep: '#B8962A', // gold-700
  lilac: '#9591F8', // lilac-500
  coral: '#E55541', // coral-500
  lime: '#BEE860', // lime-500
} as const;

export const VIBE_BACKGROUNDS: Record<VibeColour, string> = {
  gold: WRAPPED_COLOURS.gold,
  lilac: WRAPPED_COLOURS.lilac,
  coral: WRAPPED_COLOURS.coral,
  lime: WRAPPED_COLOURS.lime,
};

/** The story frames alternate the Paper and Ink surfaces (Arthur's spec), each with one accent. */
export const FRAME_THEMES: Record<number, { ground: 'cream' | 'ink'; accent: VibeColour }> = {
  1: { ground: 'cream', accent: 'gold' },
  2: { ground: 'ink', accent: 'lilac' },
  3: { ground: 'cream', accent: 'coral' },
  4: { ground: 'ink', accent: 'lime' },
  5: { ground: 'cream', accent: 'lilac' },
  6: { ground: 'ink', accent: 'gold' },
  7: { ground: 'cream', accent: 'coral' },
  8: { ground: 'ink', accent: 'gold' },
};

/** The share image's size, exactly (spec and tokens: --frame-width, --frame-height). */
export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1920;

/** The tokens' strokes: outlines on hero type and stickers, and lines. */
export const STROKE_OUTLINE = 4;
export const STROKE_LINE = 3;

/**
 * Where the face and prop go on a share-card frame (manifest.frame): boxes are
 * [x, y, w, h] before the polaroid's −3° turn around (540, 960).
 */
export const POLAROID = {
  rotationDeg: -3,
  origin: [540, 960] as const,
  outer: [240, 560, 600, 760] as const,
  window: [280, 600, 520, 520] as const,
  circle: { cx: 540, cy: 860, r: 225 },
  caption: [280, 1140, 520, 160] as const,
  prop: [280, 560, 520, 173] as const,
};

/** Arthur's art, served from public/wrapped (WebP of his PNGs, lossless). */
export function wrappedArt(kind: 'frame' | 'face' | 'prop', vibeId: number): string {
  const id = String(vibeId).padStart(2, '0');
  return `/wrapped/${kind}s/${kind}-${id}.webp`;
}

import type { VibeColour } from './copy';

/**
 * Wrapped's palette (Arthur's spec: cream, ink and gold lead; lilac, coral and
 * lime are campaign accents only; no Spotify names, logos or green). One set of
 * values for the story screens (CSS) and the share image (canvas), so the PNG
 * matches what the student saw. Placeholders until the design system file from
 * Arthur's canvas lands; swap the values here, nowhere else.
 */
export const WRAPPED_COLOURS = {
  cream: '#F5EEDF',
  ink: '#17130D',
  gold: '#E3A630',
  lilac: '#B8A4F0',
  coral: '#FF7B5E',
  lime: '#D3EA6F',
  /** Ink at reading weight on cream, and cream on ink, for body text. */
  inkSoft: '#3D352A',
  creamSoft: '#D9CFBC',
} as const;

export const VIBE_BACKGROUNDS: Record<VibeColour, string> = {
  gold: WRAPPED_COLOURS.gold,
  lilac: WRAPPED_COLOURS.lilac,
  coral: WRAPPED_COLOURS.coral,
  lime: WRAPPED_COLOURS.lime,
};

/** Frames alternate cream and ink (spec), each with one accent. */
export const FRAME_THEMES: Record<number, { ground: 'cream' | 'ink'; accent: keyof typeof WRAPPED_COLOURS }> = {
  1: { ground: 'cream', accent: 'gold' },
  2: { ground: 'ink', accent: 'lilac' },
  3: { ground: 'cream', accent: 'coral' },
  4: { ground: 'ink', accent: 'lime' },
  5: { ground: 'cream', accent: 'lilac' },
  6: { ground: 'ink', accent: 'gold' },
  7: { ground: 'cream', accent: 'coral' },
  8: { ground: 'ink', accent: 'gold' },
};

/** The share image's size, exactly (spec). */
export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1920;

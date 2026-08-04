import type { CSSProperties } from 'react';

/**
 * crest-model — the pure colour and monogram math behind the one collab
 * identity mark. No JSX and no hooks, so a row, a header, a skeleton and a
 * dialog preview all resolve the SAME paint for the same object without
 * importing a component. (Named `-model` rather than `crest.ts` because a
 * case-insensitive filesystem cannot hold that beside `Crest.tsx`.)
 *
 * ── WHY AN IDENTITY MARK AT ALL ────────────────────────────────────────────
 * Every collab surface led with the same grey type glyph, so a list of fifty
 * spaces was READ, never recognised. A monogram plus a stable hue gives each
 * object a silhouette a reader learns in a week and then navigates by.
 *
 * ── WHAT IS DERIVED FROM WHAT, AND WHY IT MATTERS ──────────────────────────
 * The HUE comes from the **uuid** and the MONOGRAM from the **name**. That
 * split is deliberate: renaming a space changes its letters (which must stay
 * truthful) but must NOT change its colour, because the colour is the thing
 * peripheral vision has memorised. A uuid never changes, so a crest's hue is
 * fixed for the life of the object, identical on every device and every render
 * — the hash is a pure function of the string, with no randomness, no clock
 * and no module state.
 *
 * ── THE HUE PALETTE, AND THE GOLD IT MUST NOT FIGHT ────────────────────────
 * The product's accent is `oklch(… 82)` and it carries ALL signal work: the
 * unread dot, the mention badge, the active chip. So the crest palette
 *  1. excludes the hue band 45°–120° entirely — no crest can read as gold; and
 *  2. holds a LOW chroma at both ends (0.036 tinted ground, ≤0.095 monogram)
 *     against the accent's 0.14, so a crest is a tint and the badge beside it
 *     is a colour. Identity is decoration; gold is information.
 * Eleven hues, ≥25° apart, at 25° spacing round the remaining arc. Eleven is
 * prime, which spreads a modulo hash evenly across the set.
 *
 * ── CONTRAST ───────────────────────────────────────────────────────────────
 * Lightness alone carries the contrast, so every hue is safe at once. Light
 * theme pairs L .947 ground with L .415 ink; dark pairs L .315 with L .868 —
 * both comfortably past 4.5:1 for any hue, and both stay past it if the
 * browser gamut-maps the chroma down for a hue sRGB cannot hold.
 */

/** The crest wheel — see the docblock for the two exclusions it encodes. */
const CREST_HUES: readonly number[] = [
  130, 155, 180, 205, 230, 255, 280, 305, 330, 355, 20,
];

/** Style objects carrying the crest custom properties. Typed rather than cast:
 *  React's `CSSProperties` has no index signature for `--*`. */
type CrestStyle = CSSProperties & Record<`--crest-${string}`, string>;

/**
 * FNV-1a (32-bit) over the uuid. Chosen over "sum the char codes" because
 * uuids share long structural runs (`-4`, version and variant nibbles) that a
 * sum collides on; FNV's multiply-and-xor avalanches those into different
 * buckets. `Math.imul` keeps the multiply in 32-bit integer space so the
 * result is identical in every engine.
 */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The object's fixed hue. Pure in the uuid — same answer everywhere, forever. */
function crestHue(uuid: string): number {
  return CREST_HUES[hashString(uuid) % CREST_HUES.length];
}

/**
 * The letters. Two words give their initials ("Firm HQ" → FH); one word gives
 * its first two characters ("general" → GE). Split on the separators object
 * names actually use, and stepped with `Array.from` so an astral first
 * character (an emoji, a CJK ideograph) is taken whole instead of as half a
 * surrogate pair. Uppercasing is a no-op on those, which is the right
 * behaviour rather than a special case.
 *
 * NOT `getInitials` from `lib/utils/collab`: that takes the FIRST and LAST
 * word, which is right for a person ("Ada Chidinma Nwosu" → AN) and wrong for
 * an object ("Firm HQ Matter 4471" → F4).
 */
export function crestMonogram(name: string): string {
  const words = name.trim().split(/[\s\-_/·|]+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = Array.from(words[0]);
  if (words.length === 1) return first.slice(0, 2).join('').toUpperCase();
  return `${first[0]}${Array.from(words[1])[0]}`.toUpperCase();
}

/**
 * The four colours a crest paints with, as custom properties. Both themes are
 * emitted at once and the component picks with the `dark:` variant, because an
 * inline style cannot branch on theme and a theme-branching class cannot carry
 * a per-object hue.
 */
export function crestStyle(uuid: string): CrestStyle {
  const hue = crestHue(uuid);
  return {
    '--crest-bg': `oklch(0.947 0.036 ${hue})`,
    '--crest-fg': `oklch(0.415 0.095 ${hue})`,
    '--crest-bg-dark': `oklch(0.315 0.048 ${hue})`,
    '--crest-fg-dark': `oklch(0.868 0.072 ${hue})`,
  };
}

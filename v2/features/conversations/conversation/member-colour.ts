import type { CSSProperties } from 'react';

/**
 * member-colour — each person in a space chat asks in a colour of their own
 * (Stay, 13 October 2026: "the chat bubbles of the users should be different.
 * there should be some general consistency, every owner should have a fixed
 * color user 1, user 2, user 3, etc").
 *
 * ── WHO GETS WHICH COLOUR ──────────────────────────────────────────────────
 * By the space's roster, so a person has the same colour in every chat of the
 * space and every reader sees the same person in the same colour: the Owner
 * is colour 1, then the other members in the order they joined. Someone who
 * has asked in the chat but is no longer on the roster (they left) takes the
 * next free colour, in the order they first asked. After eight the colours
 * wrap. The reader's own turns use the reader's own colour, so "you" here is
 * the colour everyone else sees you in. A personal chat has no roster and
 * keeps its plain bubbles (`memberColours` null).
 *
 * ── THE PALETTE ────────────────────────────────────────────────────────────
 * Eight hues from the space crest's wheel (`collab/kit/crest-model.ts`), gold
 * excluded for the same reason it is there (gold is the app's information
 * colour), ordered so neighbouring indices sit far apart round the wheel.
 * Lightness carries the contrast, so every hue is safe at once: the bubble
 * ground is L .947 in light and L .315 in dark under the theme's foreground
 * text (far past 4.5:1), and the name ink L .415 / L .868, the crest's own
 * pairs.
 */
export const MEMBER_HUES: readonly number[] = [230, 155, 330, 20, 280, 180, 130, 305];

/** Style objects carrying the member custom properties, typed (React's
 *  `CSSProperties` has no index signature for `--*`). */
export type MemberStyle = CSSProperties & Record<`--member-${string}`, string>;

/** The colours of palette slot `index` (wrapping after eight), both themes at
 *  once; the classes pick with `dark:`. */
export function memberStyle(index: number): MemberStyle {
  const hue = MEMBER_HUES[((index % MEMBER_HUES.length) + MEMBER_HUES.length) % MEMBER_HUES.length];
  return {
    '--member-bg': `oklch(0.947 0.036 ${hue})`,
    '--member-ink': `oklch(0.415 0.095 ${hue})`,
    '--member-bg-dark': `oklch(0.315 0.048 ${hue})`,
    '--member-ink-dark': `oklch(0.868 0.072 ${hue})`,
  };
}

/** One roster row, as the colours need it. */
export interface RosterEntry {
  uuid: string;
  owner: boolean;
  /** ISO time; a row without one sorts after those with one. */
  joinedAt: string | null;
}

/**
 * Each person's palette index: the Owner first, the rest of the roster by
 * join time (then uuid, so a tie is still stable), then anyone who asked but
 * is not on the roster, by first appearance in `askedInOrder` (the user turns'
 * author uuids, oldest first). Pure.
 */
export function memberColourIndex(
  roster: readonly RosterEntry[],
  askedInOrder: readonly string[],
): ReadonlyMap<string, number> {
  const byJoin = (a: RosterEntry, b: RosterEntry): number => {
    if (a.joinedAt !== b.joinedAt) {
      if (a.joinedAt === null) return 1;
      if (b.joinedAt === null) return -1;
      return a.joinedAt < b.joinedAt ? -1 : 1;
    }
    return a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0;
  };
  const ordered = [
    ...roster.filter((row) => row.owner).sort(byJoin),
    ...roster.filter((row) => !row.owner).sort(byJoin),
  ];
  const colours = new Map<string, number>();
  for (const row of ordered) if (!colours.has(row.uuid)) colours.set(row.uuid, colours.size);
  for (const uuid of askedInOrder) if (!colours.has(uuid)) colours.set(uuid, colours.size);
  return colours;
}

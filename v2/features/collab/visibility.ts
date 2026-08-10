import { EyeOff, Hash, Lock, type LucideIcon } from 'lucide-react';

import type { ChannelVisibility } from '@/types/collab';

/**
 * One place that decides how a channel's visibility LOOKS and READS.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * Six files carried their own copy of `visibility === 'private' ? Lock : Hash`.
 * That worked while there were two states. On 2026-08-10 the API grew a third,
 * and every one of those copies would have drawn a HIDDEN channel with the OPEN
 * glyph — the loudest possible lie about a privacy setting, in six places, with
 * nothing to make anyone notice. A ternary cannot be exhaustive; a record keyed
 * by the union can, and TypeScript now fails the build if a fourth state ever
 * arrives and this table does not answer for it.
 *
 * ── THE WORDS ARE HERE TOO, AND THAT IS DELIBERATE ─────────────────────────
 * The glyph and the sentence explaining it were drifting apart: the create
 * dialog told people a private channel "stays hidden from the rest of the
 * space" for four hours after that stopped being true. Keeping the mark and its
 * meaning in one record is what stops them disagreeing again.
 *
 * `title`/`description` are for controls that ask somebody to CHOOSE. For a
 * channel the server already sent, prefer its own `visibility_label` — that is
 * the server's wording and it stays right without a deploy.
 */
export interface ChannelVisibilityFace {
  readonly icon: LucideIcon;
  /** Short name for a chooser. */
  readonly title: string;
  /** What picking it actually does, in the reader's terms. */
  readonly description: string;
  /** Fallback label when no server `visibility_label` is to hand. */
  readonly label: string;
}

export const CHANNEL_VISIBILITY_FACES: Readonly<
  Record<ChannelVisibility, ChannelVisibilityFace>
> = {
  space_public: {
    icon: Hash,
    title: 'Open',
    description: 'Everyone in the space can read it and join it.',
    label: 'Open to the space',
  },
  private: {
    icon: Lock,
    title: 'Private',
    description:
      'Everyone in the space sees the name. Only its members read it. Anyone else asks to join and an admin decides.',
    label: 'Private',
  },
  hidden: {
    icon: EyeOff,
    title: 'Hidden',
    description:
      'It does not appear anywhere. Only the people in it know it exists.',
    label: 'Hidden',
  },
};

/** The face for one visibility. Falls back to `hidden` — the SHUTTEST state —
 *  if the server ever sends a value this build has not heard of, because
 *  guessing "open" about an unknown privacy setting is the one wrong way to be
 *  wrong. */
export function channelVisibilityFace(
  visibility: ChannelVisibility,
): ChannelVisibilityFace {
  return CHANNEL_VISIBILITY_FACES[visibility] ?? CHANNEL_VISIBILITY_FACES.hidden;
}

/** Just the glyph — the shape six call sites actually wanted. */
export function channelVisibilityIcon(
  visibility: ChannelVisibility,
): LucideIcon {
  return channelVisibilityFace(visibility).icon;
}

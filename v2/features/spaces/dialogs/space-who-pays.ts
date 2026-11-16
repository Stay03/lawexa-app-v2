import { UserRound, Users } from 'lucide-react';

import type { Space, SpaceWhoPays } from '@/types/collab';
import type { Choice } from '@/v2/features/collab/kit/ChoiceCards';

/* Who pays for Lawexa in a Space (Stay, 15 November 2026, thread 39c968a5;
 * Backend space-who-pays bd3e73df). `who_pays` is 'owner' (one plan covers the
 * Space: the owner's, or the member's who agreed to pay) or 'each_member' (each
 * sender's own plan). Only the owner changes it, with PUT /spaces/{uuid}. A
 * university Space is always each member's, whatever `who_pays` says, so its
 * owner reads a line instead of a choice. */

export const WHO_PAYS_LEGEND = 'Who pays for Lawexa';
export const UNIVERSITY_PAYS_LINE = 'In a university Space each member pays for their own Lawexa use.';

/** What the edit form draws for who pays: the choice, the university line, or nothing. */
export function whoPaysField(space: Space | undefined, ownsSpace: boolean): 'choice' | 'university' | null {
  // A server from before who-pays sends no `who_pays`: nothing to set.
  if (!space || !ownsSpace || space.who_pays === undefined) return null;
  return space.is_university === true ? 'university' : 'choice';
}

export function savedWhoPays(space: Space | undefined): SpaceWhoPays {
  return space?.who_pays ?? 'owner';
}

/** The two choices. The one-payer card names whose plan pays today, when the server says. */
export function whoPaysChoices(payer: Space['payer']): readonly Choice<SpaceWhoPays>[] {
  const whose = !payer ? 'One plan covers' : payer.is_owner ? 'Your plan covers' : `${payer.name}’s plan covers`;
  return [
    { value: 'owner', icon: UserRound, title: 'One payer', description: `${whose} everyone’s Lawexa use here.` },
    { value: 'each_member', icon: Users, title: 'Each member', description: 'Each person’s Lawexa use comes from their own plan.' },
  ];
}

/** Said under the choice when a switch to each member stops another member paying (the server drops the payer). */
export function payerStopsLine(space: Space | undefined, draft: SpaceWhoPays): string | null {
  const payer = space?.payer;
  if (draft !== 'each_member' || savedWhoPays(space) === 'each_member' || !payer || payer.is_owner) return null;
  return `${payer.name} will stop paying for this Space.`;
}

/** The key the save sends: only from the owner's choice, and only when it changed. */
export function whoPaysPatch(
  space: Space | undefined,
  ownsSpace: boolean,
  draft: SpaceWhoPays,
): { who_pays?: SpaceWhoPays } {
  return whoPaysField(space, ownsSpace) === 'choice' && draft !== savedWhoPays(space) ? { who_pays: draft } : {};
}

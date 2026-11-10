import type { ChannelQuizVisibility } from '@/types/channel-quiz';

/**
 * Who gets Challenge a friend, and what the tap does (Arthur, 10 November
 * 2026; decision e in thread f730f71c). A link opens a "link" or "public"
 * quiz, so the tap shares. On the author's own quiz that no link opens yet
 * ("Only you", or shared with a Space), the tap also opens it to the link.
 * Anyone else on such a quiz, or a quiz still loading, gets no Challenge.
 * The hook that acts on it: `use-challenge-friend.ts`.
 */
export type ChallengeReach = 'share' | 'open-and-share' | null;

export function challengeReach(visibility: ChannelQuizVisibility | null, isMine: boolean): ChallengeReach {
  if (visibility === 'link' || visibility === 'public') return 'share';
  if (isMine && (visibility === 'private' || visibility === 'shared')) return 'open-and-share';
  return null;
}

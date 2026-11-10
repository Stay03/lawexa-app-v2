'use client';

import type { ChannelQuizVisibility } from '@/types/channel-quiz';
import { useSetQuizVisibility } from '@/v2/features/channels/quiz/mutations';
import { useShareAction } from '@/v2/features/sharing/use-share-action';
import { challengeReach } from './challenge-reach';
import { quizChallengeHref, quizFrontHref } from './model';

/**
 * Challenge a Friend, in one tap (Arthur, 10 November 2026; decision e in
 * thread f730f71c): a friend gets the quiz's link and takes it on their own,
 * with their own score.
 *
 * A link opens a "link" or "public" quiz, so the tap only shares. On the
 * author's own quiz that no link opens yet ("Only you", or shared with a
 * Space), the same tap also switches it to "Anyone with the link": no settings
 * screen first. Anyone else reading a quiz no link opens gets no Challenge,
 * never an address that answers 404.
 *
 * The share sheet opens in the tap itself, beside the switch rather than after
 * it: a phone opens the sheet only from the tap, and the address does not
 * change, only who may open it. Should the switch fail, `openFailed` says the
 * link will not open for a friend yet, and the next tap tries again.
 */
export function useChallengeFriend({
  quizUuid,
  fromAttempt = null,
  title,
  text,
  visibility,
  isMine,
}: {
  quizUuid: string;
  /** The reader's own finished attempt: the link carries it, and the friend sees the score to beat. */
  fromAttempt?: string | null;
  /** Shown by the share sheet above the link. */
  title: string | null;
  /** The sentence the sheet gets beside the link: the score and the ask. */
  text: string;
  /** Null while the quiz is still loading: no Challenge yet. */
  visibility: ChannelQuizVisibility | null;
  isMine: boolean;
}): { available: boolean; challenge: () => void; copied: boolean; openFailed: boolean } {
  const path = fromAttempt ? quizChallengeHref(quizUuid, fromAttempt) : quizFrontHref(quizUuid);
  const share = useShareAction({ path, title, text });
  const openToLink = useSetQuizVisibility(quizUuid);
  const reach = challengeReach(visibility, isMine);

  const challenge = () => {
    if (reach === null) return;
    if (reach === 'open-and-share') openToLink.mutate('link');
    void share.share();
  };

  return { available: reach !== null, challenge, copied: share.copied, openFailed: openToLink.isError };
}

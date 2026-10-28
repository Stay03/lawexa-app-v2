'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { feedbackApi } from '@/lib/api/feedback';
import { useV2Session } from '@/v2/runtime/session-context';
import { ChatRatingBanner, chatPromptQuery } from './ChatRatingBanner';
import { beginPlanEndedOffer, useActiveOffer, useAskedThisSession } from './store';

/**
 * PlanEndedRating — "How is Lawexa doing?" once after a paid plan runs out
 * (Arthur, 28 October 2026, "B plus A"), on the FIRST screen the reader opens,
 * home, the chat list or a chat (Stay, 28 October 2026: "how can the user chat
 * if the plan has run out?"). The server says when (`moment: "plan_ended"`,
 * once, outside the 14 days); this asks it once a session as the app opens.
 *
 * Mounted once, in the v2 layout. The banner floats above the page's foot and
 * is about no chat: a rating names none (Backend 0c7bb3c2). Shown and closed
 * are reported, as for the chat's banner, so it asks once.
 */
export function PlanEndedRating() {
  const { signedIn, role, userId } = useV2Session();
  const isAccount = signedIn && role !== null && role !== 'guest' && role !== 'bot';
  const askedThisSession = useAskedThisSession();
  const active = useActiveOffer();

  const prompt = useQuery({ ...chatPromptQuery(userId), enabled: isAccount && !askedThisSession });
  const planEnded = isAccount && prompt.data?.eligible === true && prompt.data.moment === 'plan_ended';

  useEffect(() => {
    if (planEnded && beginPlanEndedOffer()) {
      void feedbackApi.chatPromptSeen('shown').catch(() => undefined);
    }
  }, [planEnded]);

  if (!active || active.trigger !== 'plan_ended') return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-6">
      <div className="pointer-events-auto w-full max-w-md shadow-lg">
        <ChatRatingBanner key={active.seq} offer={active} />
      </div>
    </div>
  );
}

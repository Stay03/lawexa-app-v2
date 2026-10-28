'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { feedbackApi } from '@/lib/api/feedback';
import { useV2Session } from '@/v2/runtime/session-context';
import { ChatRatingBanner, chatPromptQuery } from './ChatRatingBanner';
import { beginPlanEndedOffer, useActiveOffer, useAskedThisSession } from './store';

/**
 * PlanEndedSlot — "How is Lawexa doing?" once after a paid plan runs out
 * (Arthur, 28 October 2026, "B plus A"), on the first screen the reader opens
 * that can ask (Stay: "how can the user chat if the plan has run out?").
 *
 * In the page, never floating (Arthur picked B, 28 October 2026): it sits just
 * above the message box on the home and in a chat, and under the title on the
 * chat list, which has no box. The server says when (`moment: "plan_ended"`,
 * once, outside the 14 days); a slot asks it once a session, through the same
 * cached answer as the chat's own banner. The rating names no chat (Backend
 * 0c7bb3c2). Shown and closed are reported, so it asks once.
 */
export function PlanEndedSlot({ className }: { className?: string }) {
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
    <div className={cn('w-full', className)}>
      <ChatRatingBanner key={active.seq} offer={active} />
    </div>
  );
}

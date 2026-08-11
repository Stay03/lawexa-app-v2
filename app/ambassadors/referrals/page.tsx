import type { Metadata } from 'next';

import { ReferralScreen } from '@/components/ambassadors/ReferralScreen';

/**
 * `/ambassadors/referrals` — an ambassador's own referral code and link.
 *
 * ── WHY IT IS HERE AND NOT UNDER `app/v2/` ─────────────────────────────────
 * The owner's answer, asked and given 2026-08-11: "old and new". Every
 * ambassador we actually have is on v1 — the v2 cookie is written only by the
 * developer-settings toggle — so a v2-only route would 404 for every single
 * person this screen exists for, including from the link in their welcome
 * email. Sitting at the app root it inherits `app/layout.tsx` (providers, no
 * chrome) and is served to everyone whichever app they are on. `app/join` is
 * here for the same reason, and learned it the hard way.
 *
 * THE SCREEN THEREFORE USES `components/ui` PRIMITIVES ONLY. Lint forbids v1
 * code importing from `v2/`, because the whole point of the strangler-fig
 * layout is that v2 stays deletable in one command. A page served to everybody
 * cannot depend on the half of the app only some people can see.
 *
 * ── THE ADDRESS ────────────────────────────────────────────────────────────
 * `/ambassadors` and `/ambassadors/face-card` are EXACT-path rewrites to static
 * files (`next.config.ts`), so a nested app route beside them does not collide
 * — checked before choosing this path. It also reads as a sibling of the face
 * card, which is where the code ends up printed.
 *
 * `noindex`: this is one person's own page and their code is on it.
 */
export const metadata: Metadata = {
  title: 'Your referral link',
  description: 'Your ambassador code, and the link that credits you.',
  robots: { index: false, follow: false },
};

export default function ReferralsPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <ReferralScreen />
    </main>
  );
}

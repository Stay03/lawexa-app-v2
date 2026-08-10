import type { Metadata } from 'next';

import { JoinScreen } from '@/components/join/JoinScreen';

/**
 * `/join/{code}` — the screen an invite link lands on.
 *
 * ── WHY IT LIVES HERE AND NOT UNDER `app/v2/` ──────────────────────────────
 * It was built under `app/v2/` first, with an exception in `proxy.ts` so it
 * would reach people without the opt-in cookie. Then it was opened in a browser
 * signed out, and the top of the page read "Chat · Work · Study" — a stranger
 * with no account was being shown the signed-in app's navigation, because
 * everything under `app/v2/` inherits the `AppShell` layout.
 *
 * The fix was not to fight that layout. It was to notice the page does not
 * belong inside the app at all: it is the doorstep, not a room. Sitting at the
 * app root it inherits only `app/layout.tsx` — providers, no chrome — and it is
 * served to EVERYONE by default, so the proxy exception disappeared with it.
 * `quiz-results` is here for the same reason.
 *
 * THE SCREEN ITSELF THEREFORE LIVES IN `components/join/`, NOT `v2/`. Lint
 * caught the first attempt: v1 code may not import from v2, because the whole
 * point of the strangler-fig layout is that v2 stays separately deletable. A
 * page served to everybody cannot depend on the half of the app only some
 * people see, so the screen uses `components/ui` primitives only.
 *
 * `noindex`: an invite code is a key, and keys do not belong in search results.
 */
export const metadata: Metadata = {
  title: 'Join on Lawexa',
  robots: { index: false, follow: false },
};

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <JoinScreen code={code} />
    </main>
  );
}

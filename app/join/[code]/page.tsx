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
/**
 * THE CARD THAT APPEARS WHEN THE LINK IS PASTED INTO WHATSAPP.
 *
 * @arthur, 2026-08-10: the page itself was right and this was still wrong. A
 * static title meant every invite ever sent previewed as "Join on Lawexa" over
 * the site's generic blurb about legal research — so the moment somebody shares
 * an invite, the thing their friend actually reads says nothing about the space
 * they are being invited to. The landing page we spent the afternoon on is the
 * SECOND thing they see. This is the first.
 *
 * So the preview is fetched here, on the server, and the card is written from
 * it. The endpoint is deliberately unauthenticated — WhatsApp's crawler carries
 * no account, which is exactly the case it was built for.
 *
 * `noindex` STAYS. An invite code is a key: it may be unfurled in a chat, and
 * it must never be sitting in a search result. Unfurling and indexing are
 * different things and this allows only the first.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const fallback: Metadata = {
    title: 'Join on Lawexa',
    description: 'You have been invited to a space on Lawexa.',
    robots: { index: false, follow: false },
  };

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'https://prod-api.lawexa.com/api'}/invite-links/${code}`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 60 } },
    );
    if (!response.ok) return fallback;

    const invite = (await response.json())?.data;
    if (!invite?.space_name) return fallback;

    // The channel is the more specific thing when the link names one.
    const place = invite.channel_name
      ? `#${invite.channel_name}`
      : invite.space_name;
    const title = invite.inviter_name
      ? `${invite.inviter_name} invited you to ${place}`
      : `You have been invited to ${place}`;

    // Same rule as the page: never blank, and never a placeholder either.
    const written = invite.channel_name
      ? invite.channel_description
      : invite.space_description;
    const description =
      written?.trim() ||
      (invite.channel_name
        ? `A channel in ${invite.space_name} on Lawexa.`
        : invite.space_type === 'study'
          ? `A study space on Lawexa. ${invite.member_count} already here.`
          : `A work space on Lawexa. ${invite.member_count} already here.`);

    return {
      title,
      description,
      robots: { index: false, follow: false },
      openGraph: { title, description, type: 'website', siteName: 'Lawexa' },
      twitter: { card: 'summary', title, description },
    };
  } catch {
    // A crawler must still get a sensible card if the API is unreachable.
    return fallback;
  }
}

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

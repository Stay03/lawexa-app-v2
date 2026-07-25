import type { Metadata } from 'next';
import { fetchConversationForMetadata } from '@/lib/api/server';
import { SEO, getAppUrl } from '@/lib/constants/seo';
import { ConversationScreen } from '@/v2/features/conversations/conversation/ConversationScreen';

/**
 * v2 `/c/[conversationId]` — server shell. Follows the v2 metadata convention
 * (app/v2/layout.tsx docblock): a server `page.tsx` exporting `generateMetadata`
 * that renders a `'use client'` child. The metadata mirrors v1's `/c/[id]`
 * reference implementation field-for-field (bare `title` so the root
 * "%s | Lawexa" template appends the brand; canonical + OG built from the FRONTEND
 * app URL, never the backend `meta.canonical`; the per-conversation OG card).
 *
 * OWNERSHIP, UNCHANGED IN STRENGTH. This segment no longer calls
 * `verifySession()` — that `await` was an uncached `/auth/me` round trip on every
 * navigation into a conversation (React `cache()` dedupes only within one server
 * render, and a soft navigation re-renders this page without re-rendering the
 * layout), which is what made `loading.tsx` cover a wait on Laravel every time.
 * That shortened the wait but did not remove the boundary; `unstable_dynamicStaleTime`
 * below does, by letting a return trip skip the round trip entirely. The ownership id
 * the client screen checks against is still `verifySession()`'s server-verified
 * `user.id` and nothing else: the v2 layout calls `verifySession()` once and
 * publishes that id through `<V2SessionProvider>`, and `ConversationScreen` reads
 * it from there. Same function, same server, same value — only the delivery
 * changed, from a prop threaded through this page to context threaded through the
 * layout. Cookie presence is never substituted for it, and the backend remains
 * the authority regardless (the transcript fetch 401s on its own).
 */
interface ConversationPageProps {
  params: Promise<{ conversationId: string }>;
}

export async function generateMetadata({ params }: ConversationPageProps): Promise<Metadata> {
  const { conversationId } = await params;
  const appUrl = getAppUrl();
  const conversation = await fetchConversationForMetadata(conversationId);

  // Private / archived / non-existent (API 404) → the site default (already
  // brand-prefixed, so opt out of the template with `absolute`).
  if (!conversation) {
    return {
      title: { absolute: SEO.defaultTitle },
      description: SEO.defaultDescription,
    };
  }

  const { meta } = conversation;
  const canonicalUrl = `${appUrl}/c/${conversationId}`;
  const ogImageUrl = `${appUrl}/api/og/c/${conversationId}`;

  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: canonicalUrl,
      siteName: SEO.siteName,
      type: 'article',
      locale: SEO.locale,
      images: [
        {
          url: ogImageUrl,
          width: SEO.ogImageWidth,
          height: SEO.ogImageHeight,
          alt: conversation.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      site: SEO.twitterHandle,
      images: [ogImageUrl],
    },
    robots: { index: true, follow: true },
  };
}

/**
 * KEEP THIS PAGE IN THE CLIENT ROUTER CACHE FOR 5 MINUTES. Same lever and same
 * safety argument as `app/v2/conversations/page.tsx`, which carries the full note.
 *
 * The transcript itself is already cached (`conversationsQueries.detail`, 30-minute
 * retention, seeded into the engine at construction), so a revisit re-painted it in
 * the first render — but only AFTER a server round trip that this segment does not
 * need, with `loading.tsx` over the top of it. Re-using the payload is what lets
 * that first render actually be the first thing the user sees.
 *
 * WHAT THE PAYLOAD HOLDS. Only this route's metadata (title, canonical, OG card).
 * That is head content, invisible in-app, and `fetchConversationForMetadata` is
 * itself revalidated every 60s server-side. A conversation whose title upgrades
 * within the window shows the new title in the app immediately regardless — the
 * header reads it from the engine, not from here.
 */
export const unstable_dynamicStaleTime = 300;

export default async function V2ConversationPage({ params }: ConversationPageProps) {
  // The only remaining await: the route params, which cost no I/O.
  const { conversationId } = await params;

  return <ConversationScreen conversationId={conversationId} />;
}

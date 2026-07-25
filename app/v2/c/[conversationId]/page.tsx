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
 * The route stays dynamic, so that boundary still shows for one I/O-free Next
 * round trip — the wait is shortened, not removed. The ownership id
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

export default async function V2ConversationPage({ params }: ConversationPageProps) {
  // The only remaining await: the route params, which cost no I/O.
  const { conversationId } = await params;

  return <ConversationScreen conversationId={conversationId} />;
}

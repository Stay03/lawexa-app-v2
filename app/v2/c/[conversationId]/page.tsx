import type { Metadata } from 'next';
import { fetchConversationForMetadata } from '@/lib/api/server';
import { SEO, getAppUrl } from '@/lib/constants/seo';
import { verifySession } from '@/v2/runtime/session';
import { ConversationScreen } from '@/v2/features/conversations/conversation/ConversationScreen';

/**
 * v2 `/c/[conversationId]` — server shell. Follows the v2 metadata convention
 * (app/v2/layout.tsx docblock): a server `page.tsx` exporting `generateMetadata`
 * that renders a `'use client'` child. The metadata mirrors v1's `/c/[id]`
 * reference implementation field-for-field (bare `title` so the root
 * "%s | Lawexa" template appends the brand; canonical + OG built from the FRONTEND
 * app URL, never the backend `meta.canonical`; the per-conversation OG card).
 *
 * `verifySession()` is React-cached, so this shares the single `/auth/me` round
 * trip with the layout; the resolved user id is threaded to the client screen for
 * the server-verified ownership (view-only) check.
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
  const { conversationId } = await params;
  const session = await verifySession();

  return (
    <ConversationScreen
      conversationId={conversationId}
      serverUserId={session?.user.id ?? null}
    />
  );
}

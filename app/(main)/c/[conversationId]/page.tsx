import type { Metadata } from 'next';
import { fetchConversationForMetadata } from '@/lib/api/server';
import { SEO, getAppUrl } from '@/lib/constants/seo';
import ConversationClient from './conversation-client';

interface ConversationPageProps {
  params: Promise<{ conversationId: string }>;
}

export async function generateMetadata({ params }: ConversationPageProps): Promise<Metadata> {
  const { conversationId } = await params;
  const appUrl = getAppUrl();
  const conversation = await fetchConversationForMetadata(conversationId);

  // Fallback for private, archived, or non-existent conversations (API returns 404)
  if (!conversation) {
    return {
      title: SEO.defaultTitle,
      description: SEO.defaultDescription,
    };
  }

  const { meta } = conversation;
  // Always construct URLs from the frontend app URL.
  // Do NOT use meta.canonical from the backend — it points to the API server domain.
  const canonicalUrl = `${appUrl}/c/${conversationId}`;
  const ogImageUrl = `${appUrl}/api/og/c/${conversationId}`;

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: canonicalUrl,
    },
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
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function ConversationPage() {
  return <ConversationClient />;
}

import { getApiUrl } from '@/lib/constants/seo';

export interface SeoMeta {
  title: string;
  description: string;
  canonical: string;
}

/**
 * Lightweight conversation data returned by the public SEO endpoint.
 * Does not include messages — only metadata needed for SEO tags and OG images.
 */
export interface ConversationMetadata {
  id: string;
  title: string;
  messages_count: number;
  views_count?: number;
  author?: { name: string };
  agent?: { name: string; slug: string };
  meta: SeoMeta;
}

/**
 * Server-side conversation fetcher for metadata generation.
 * Uses the public SEO endpoint — no authentication required.
 * Returns null for private, archived, or non-existent conversations (404).
 */
export async function fetchConversationForMetadata(
  conversationId: string
): Promise<ConversationMetadata | null> {
  const apiUrl = getApiUrl();

  try {
    const response = await fetch(`${apiUrl}/api/public/conversations/${conversationId}`, {
      headers: {
        Accept: 'application/json',
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();

    if (!json.success || !json.data) {
      return null;
    }

    return json.data as ConversationMetadata;
  } catch {
    return null;
  }
}

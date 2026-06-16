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

/**
 * Lightweight shared-scan data for metadata generation — only the fields the
 * OG/SEO tags need. The public endpoint returns the trimmed reader shape.
 */
export interface ScanMetadata {
  title: string | null;
  report: string | null;
  radar: { uuid: string; name: string } | null;
}

/**
 * Server-side scan fetcher for metadata generation.
 * Uses the public (no-auth) endpoint — returns null for private / unknown
 * scans (404), so private reports fall back to the default site card.
 */
export async function fetchScanForMetadata(
  radarUuid: string,
  scanUuid: string
): Promise<ScanMetadata | null> {
  const apiUrl = getApiUrl();

  try {
    const response = await fetch(
      `${apiUrl}/api/public/radars/${radarUuid}/scans/${scanUuid}`,
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      return null;
    }

    const json = await response.json();

    if (!json.success || !json.data) {
      return null;
    }

    const { title, report, radar } = json.data;
    return { title: title ?? null, report: report ?? null, radar: radar ?? null };
  } catch {
    return null;
  }
}

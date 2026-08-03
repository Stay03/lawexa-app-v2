import { getApiUrl } from '@/lib/constants/seo';
import type { CaseDetail } from '@/types/case';
import type { StatuteStatus } from '@/types/statute';

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

/** The case fields `generateMetadata` and the OG card actually use. */
export interface CaseMetadata {
  title: string;
  displayTitle: string;
  citation: string | null;
  court: string | null;
  country: string | null;
  judgmentDate: string | null;
  summary: string;
  meta: CaseDetail['meta'] | null;
}

/** Collapse HTML-ish text to a plain single-line blurb, capped for a card. */
function toBlurb(value: string | null | undefined, max: number): string {
  if (!value) return '';
  const text = value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, '').trimEnd()}…`;
}

/**
 * Server-side case fetcher for metadata generation — the case page's `<head>`
 * tags and its OG card both read through this one function, so an unfurl and the
 * tags beside it can never disagree.
 *
 * DELIBERATELY UNAUTHENTICATED, and revalidated for five minutes. Both follow
 * from who it is for: the reader of a pasted link is a crawler or a signed-out
 * stranger, so the only metadata worth emitting is the metadata everyone can
 * see. Sending no token also makes the response identical for every caller,
 * which is what makes it legal to put in Next's SHARED data cache — a per-user
 * response cached across users would be a privacy defect, so this must never
 * grow an `Authorization` header.
 *
 * The window also bounds a cost we do not control: if `GET /cases/{slug}`
 * records a view per request, every social unfurl would otherwise inflate that
 * case's view count. Raised with the backend team
 * (`docs/v2-docs/backend-ask-2026-07-25-cases-read-endpoints.md`).
 *
 * It lives here beside `fetchConversationForMetadata` rather than under `v2/`
 * because the OG route (`app/api/og/cases/[slug]`) is outside the v2 tree and
 * the import boundary forbids it reaching in — and because this is exactly what
 * this module is: the shared server data layer for metadata.
 *
 * Returns `null` for anything that is not a readable case — 404, 401, a network
 * failure — so callers fall back to the site-wide card rather than emitting a
 * broken one.
 */
export async function fetchCaseForMetadata(
  slug: string
): Promise<CaseMetadata | null> {
  const apiUrl = getApiUrl().replace(/\/$/, '');

  try {
    const response = await fetch(
      `${apiUrl}/api/cases/${encodeURIComponent(slug)}`,
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 300 },
        // Bounded: a hung upstream must not stall `generateMetadata` (and with
        // it the whole page render) — the card degrades to the site default.
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as {
      success?: boolean;
      data?: CaseDetail | null;
    };
    const data = json?.data;

    if (!json?.success || !data) {
      return null;
    }

    return {
      title: data.title,
      displayTitle: data.display_title || data.title,
      citation: data.citation,
      court: data.court?.name ?? null,
      country: data.country?.name ?? null,
      judgmentDate: data.judgment_date,
      // The holding is the most useful one-line description of a case; the
      // excerpt and body are the honest fallbacks when it is absent.
      summary: toBlurb(data.principles || data.excerpt || data.body, 300),
      meta: data.meta ?? null,
    };
  } catch {
    return null;
  }
}

/** One case in the sitemap: the slug and when it last changed. */
export interface CaseSitemapEntry {
  slug: string;
  lastModified: string;
}

/**
 * The page size and page count the case sitemap enumerates.
 *
 * THE CAP IS REAL AND IS STATED, not hidden. `GET /cases` is a reader-facing
 * paginated list, not a sitemap index, so enumerating the whole library means
 * one request per page — and an unbounded loop at build time would turn a slow
 * or large library into a failed deploy. 20 pages of 100 covers the 2,000
 * most-recently-listed cases; beyond that, cases are simply absent from the
 * sitemap (they remain reachable and indexable through the library and through
 * links).
 *
 * The fix is a backend one — a slug + `updated_at` index endpoint — and it is
 * requested in `docs/v2-docs/backend-ask-2026-07-25-cases-read-endpoints.md`.
 */
const SITEMAP_PER_PAGE = 100;
const SITEMAP_MAX_PAGES = 20;

/**
 * Enumerate cases for `sitemap.xml`.
 *
 * ⚠️ THIS RETURNS NOTHING TODAY, AND THAT IS AN API FACT RATHER THAN A BUG HERE.
 * Measured against prod on July 25, 2026: `GET /api/cases` answers **401
 * Unauthenticated** without a bearer token. A sitemap is fetched by crawlers and
 * generated at build time — no user, no token in either case — so the walk below
 * stops on its first response and the sitemap ships with its eight static routes
 * and no case entries. Confirmed by reading the built `sitemap.xml`.
 *
 * It is KEPT rather than deleted because it is correct the day the endpoint
 * allows it, and the cost while blocked is one 401 per day (the loop breaks on
 * the first non-ok response). Deleting it and rediscovering the requirement
 * later is how a phase objective quietly goes missing.
 *
 * WHAT UNBLOCKS IT: a no-login read listing `slug` + a last-changed date for
 * every published case. Question 3 in the backend ask named above.
 *
 * NEVER THROWS. `sitemap.ts` runs at build time; an upstream failure must
 * degrade to the static route list rather than fail the build, so every error
 * ends the walk and returns whatever was gathered.
 */
export async function fetchCaseSitemapEntries(): Promise<CaseSitemapEntry[]> {
  const apiUrl = getApiUrl().replace(/\/$/, '');
  const entries: CaseSitemapEntry[] = [];

  for (let page = 1; page <= SITEMAP_MAX_PAGES; page += 1) {
    try {
      const response = await fetch(
        `${apiUrl}/api/cases?page=${page}&per_page=${SITEMAP_PER_PAGE}`,
        {
          headers: { Accept: 'application/json' },
          next: { revalidate: 86400 },
        }
      );
      if (!response.ok) break;

      const json = (await response.json()) as {
        data?: { slug: string; judgment_date?: string | null }[];
        pagination?: { current_page: number; last_page: number };
      };
      const rows = json?.data ?? [];
      if (rows.length === 0) break;

      for (const row of rows) {
        if (!row?.slug) continue;
        entries.push({
          // The list payload carries no `updated_at`, so the judgment date is
          // the honest stand-in — it is at least a real date about this case,
          // where "now" would tell a crawler every case changed on every build.
          slug: row.slug,
          lastModified: row.judgment_date ?? '',
        });
      }

      const pagination = json?.pagination;
      if (!pagination || pagination.current_page >= pagination.last_page) break;
    } catch {
      break;
    }
  }

  return entries;
}

/** The statute fields `generateMetadata` and the OG card actually use. */
export interface StatuteMetadata {
  title: string;
  /** The designation ("Act 459"), only when it adds to the title. */
  shortTitle: string | null;
  country: string | null;
  year: number;
  status: StatuteStatus;
  /** AKN document type, e.g. `"act"` — lowercase as the API ships it. */
  documentType: string | null;
  /** One-line description material, already collapsed and capped. */
  summary: string;
  /** The backend's SEO block. `canonical` is NEVER used — ours wins. */
  meta: SeoMeta | null;
}

/**
 * The public statute summary, as `GET /api/public/statutes/{slug}` ships it
 * (verified against prod, August 2, 2026). Deliberately never the document
 * text — the endpoint exists so crawlers can read a card, not the statute.
 */
interface PublicStatuteSummary {
  title: string;
  short_title: string | null;
  slug: string;
  year: number;
  status: StatuteStatus;
  status_label: string;
  document_type: string | null;
  country: { name: string; code: string } | null;
  description: string | null;
  meta: SeoMeta | null;
}

/**
 * Server-side statute fetcher for metadata generation — the statute page's
 * `<head>` tags and its OG card both read through this one function, so an
 * unfurl and the tags beside it can never disagree, and the pair costs one
 * upstream request rather than two (same URL, same options, one shared data
 * cache entry).
 *
 * DELIBERATELY UNAUTHENTICATED — the cases argument, verbatim: the response is
 * identical for every caller, which is what makes it legal to put in Next's
 * SHARED data cache, so this must never grow an `Authorization` header.
 *
 * REVALIDATED DAILY, and the window is load-bearing rather than taste: the
 * whole `/api/public/*` group is rate-limited to 60 requests/min per IP, and
 * our server is one IP. At `revalidate: 86400` each statute costs at most one
 * upstream request per day, shared by the tags and the card — ~1,004 statutes
 * ≈ 0.7 requests/min even if a crawler sweeps the entire catalog cold. A 429
 * during such a sweep returns `null` here, that render falls back to the
 * site-default card, and the next successful read caches for a day.
 *
 * Returns `null` for anything that is not a readable statute — 404, 429, a
 * network failure — so callers fall back to the site-wide card rather than
 * emitting a broken one.
 */
export async function fetchStatuteForMetadata(
  slug: string
): Promise<StatuteMetadata | null> {
  const apiUrl = getApiUrl().replace(/\/$/, '');

  try {
    const response = await fetch(
      `${apiUrl}/api/public/statutes/${encodeURIComponent(slug)}`,
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 86400 },
        // Bounded: a hung upstream must not stall `generateMetadata` or the OG
        // route — the card degrades to the site default.
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      return null;
    }

    const json = (await response.json()) as {
      success?: boolean;
      data?: PublicStatuteSummary | null;
    };
    const data = json?.data;

    if (!json?.success || !data) {
      return null;
    }

    return {
      title: data.title,
      shortTitle:
        data.short_title && data.short_title !== data.title
          ? data.short_title
          : null,
      country: data.country?.name ?? null,
      year: data.year,
      status: data.status,
      documentType: data.document_type ?? null,
      summary: toBlurb(data.description, 300),
      meta: data.meta ?? null,
    };
  } catch {
    return null;
  }
}

/** One statute in the sitemap: the slug and when it last changed. */
export interface StatuteSitemapEntry {
  slug: string;
  lastModified: string;
}

/**
 * The page size and page count the statute sitemap enumerates.
 *
 * Unlike the cases walk above, this one reads a REAL sitemap feed:
 * `GET /api/public/statutes` returns only `slug` + `updated_at` per row, no
 * token, `per_page` up to 1000. The catalog is ~1,004 statutes (measured
 * August 2, 2026), so the whole walk is two requests; five pages of 1,000 is
 * generous headroom before a statute could fall off the sitemap, and it keeps
 * the loop bounded the same way the cases walk is — an unbounded loop at
 * build time turns a misbehaving upstream into a failed deploy.
 */
const STATUTE_SITEMAP_PER_PAGE = 1000;
const STATUTE_SITEMAP_MAX_PAGES = 5;

/**
 * Enumerate statutes for `sitemap.xml`.
 *
 * LIVE, unlike `fetchCaseSitemapEntries` — the public feed shipped August 2,
 * 2026 and answers without a token. `updated_at` reflects body edits too
 * (confirmed with the backend), so it is an honest `lastmod` as-is.
 *
 * Revalidated daily: at most `STATUTE_SITEMAP_MAX_PAGES` (5) upstream requests
 * per day against the 60/min public-group rate limit — noise.
 *
 * NEVER THROWS. `sitemap.ts` runs at build time; an upstream failure must
 * degrade to whatever was gathered rather than fail the build, so every error
 * (including a 429 from the shared rate limit) ends the walk.
 */
export async function fetchStatuteSitemapEntries(): Promise<StatuteSitemapEntry[]> {
  const apiUrl = getApiUrl().replace(/\/$/, '');
  const entries: StatuteSitemapEntry[] = [];

  for (let page = 1; page <= STATUTE_SITEMAP_MAX_PAGES; page += 1) {
    try {
      const response = await fetch(
        `${apiUrl}/api/public/statutes?page=${page}&per_page=${STATUTE_SITEMAP_PER_PAGE}`,
        {
          headers: { Accept: 'application/json' },
          next: { revalidate: 86400 },
        }
      );
      if (!response.ok) break;

      const json = (await response.json()) as {
        data?: { slug?: string; updated_at?: string | null }[];
        pagination?: { current_page: number; last_page: number };
      };
      const rows = json?.data ?? [];
      if (rows.length === 0) break;

      for (const row of rows) {
        if (!row?.slug) continue;
        entries.push({ slug: row.slug, lastModified: row.updated_at ?? '' });
      }

      const pagination = json?.pagination;
      if (!pagination || pagination.current_page >= pagination.last_page) break;
    } catch {
      break;
    }
  }

  return entries;
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

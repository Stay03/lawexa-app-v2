import type { AxiosResponseHeaders, RawAxiosResponseHeaders } from 'axios';

import { apiClient } from './client';
import type {
  StatuteListResponse,
  StatuteDetailResponse,
  StatuteNodesResponse,
  StatuteNavigateResponse,
  StatuteListParams,
  StatuteFacetsResponse,
  StatuteNodeType,
} from '@/types/statute';

/* ── The statute paywall contract (backend live Aug 2026, switch currently OFF) ─
 *
 * `GET /statutes/{slug}/export-akn` serves the SAME AKN XML to every caller,
 * but for a non-paid caller with the switch on it is CUT after the first few
 * sections. The cut is announced ONLY via response headers:
 *
 *   X-Statute-Partial: true
 *   X-Statute-Total-Sections: 121
 *   X-Statute-Included-Sections: 3
 *
 * No headers = full document — which is also what a paid caller, a small
 * statute, the off-switch state, AND a proxy/CORS layer that does not expose
 * the headers all look like. That degradation is deliberate and safe: a
 * missing marker renders the document exactly as before the paywall existed.
 */

/** The paywall marker parsed from the export-akn response headers. */
export interface StatutePartialMeta {
  /** Sections in the full document, or null when the count header was absent
   *  or unreadable (headers are CORS-exposed individually, so the marker can
   *  arrive without its counts — consumers fall back to the outline's). */
  totalSections: number | null;
  /** Sections included in this excerpt, or null on the same terms. */
  includedSections: number | null;
}

/** What the reader consumes: the XML plus the cut marker (null = full). */
export interface StatuteAknDocument {
  xml: string;
  partial: StatutePartialMeta | null;
}

/**
 * One entry of the AKN outline endpoint — every element of the document in
 * reading order, body text omitted. Field shapes derived from a live capture
 * (courts-act-1993, 719 entries, Aug 2 2026).
 */
export interface StatuteOutlineEntry {
  eId: string;
  node_type: StatuteNodeType;
  node_type_label: string;
  number: string | null;
  title: string | null;
  depth: number;
  position: number;
  /** True when this element lies beyond the caller's free excerpt. */
  locked: boolean;
}

export interface StatuteOutlineData {
  outline: StatuteOutlineEntry[];
  total_count: number;
  total_sections: number;
  /** True when the CALLER's excerpt is cut — mirrors the export-akn marker. */
  partial: boolean;
}

// Response envelope for GET /public/statutes/{slug}/akn/outline
export interface StatuteOutlineResponse {
  success: boolean;
  message: string;
  data: StatuteOutlineData;
}

type ResponseHeaders = RawAxiosResponseHeaders | AxiosResponseHeaders;

/** One response header as a string, or null. Axios lower-cases header names,
 *  and both header container shapes support plain indexed reads. */
function headerString(headers: ResponseHeaders, name: string): string | null {
  const value = (headers as RawAxiosResponseHeaders)[name];
  return typeof value === 'string' ? value : null;
}

/** A POSITIVE integer header, or null when absent or malformed. The empty
 *  string is malformed too (`Number('')` is 0 — a section count of 0 on a
 *  partial document is never a fact, only a parsing accident). */
function headerCount(headers: ResponseHeaders, name: string): number | null {
  const raw = headerString(headers, name)?.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** The paywall marker, keyed ONLY on `X-Statute-Partial: true`. The counts
 *  are parsed independently so a partially-exposed header set still detects
 *  the cut; anything else (absent, "false", junk) means a full document. */
function parsePartialMeta(headers: ResponseHeaders): StatutePartialMeta | null {
  if (headerString(headers, 'x-statute-partial')?.toLowerCase() !== 'true') {
    return null;
  }
  return {
    totalSections: headerCount(headers, 'x-statute-total-sections'),
    includedSections: headerCount(headers, 'x-statute-included-sections'),
  };
}

/** The one export-akn request — shared by both `statutesApi` views of it
 *  (a standalone function so the object literal never references itself). */
async function fetchAknDocument(slug: string): Promise<StatuteAknDocument> {
  const response = await apiClient.get<string>(`/statutes/${slug}/export-akn`, {
    headers: { Accept: 'application/xml' },
    responseType: 'text',
    transformResponse: [(data: string) => data],
  });
  return { xml: response.data, partial: parsePartialMeta(response.headers) };
}

/**
 * Statute API service for Phase 17 endpoints
 */
export const statutesApi = {
  /**
   * Get paginated list of statutes
   */
  getList: async (params: StatuteListParams = {}): Promise<StatuteListResponse> => {
    const response = await apiClient.get<StatuteListResponse>('/statutes', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        search: params.search || undefined,
        country: params.country || undefined,
        status: params.status || undefined,
        year: params.year || undefined,
        sort: params.sort || undefined,
        order: params.order || undefined,
      },
    });
    return response.data;
  },

  /**
   * Get the countries that have statutes, with per-country counts.
   * Drives the country tabs on the statute library.
   */
  getCountryFacets: async (): Promise<StatuteFacetsResponse> => {
    const response = await apiClient.get<StatuteFacetsResponse>('/statutes/countries');
    return response.data;
  },

  /**
   * Get single statute by slug
   */
  getBySlug: async (slug: string): Promise<StatuteDetailResponse> => {
    const response = await apiClient.get<StatuteDetailResponse>(`/statutes/${slug}`);
    return response.data;
  },

  /**
   * Get nodes within a position range for a statute.
   * CAPPED at 100 nodes per request server-side (July 2026); the future
   * ranged-hydration reader consumes this with the /outline endpoint —
   * see the statute-nodes-cap migration record. Currently unconsumed
   * (the live reader uses getAknDocument; statutes-old was deleted).
   */
  getNodes: async (
    slug: string,
    from: number = 0,
    to: number = 49,
  ): Promise<StatuteNodesResponse> => {
    const response = await apiClient.get<StatuteNodesResponse>(
      `/statutes/${slug}/nodes`,
      { params: { from, to } },
    );
    return response.data;
  },

  /**
   * Navigate to a specific node by slug path (deep link)
   */
  navigate: async (slug: string, path: string): Promise<StatuteNavigateResponse> => {
    const response = await apiClient.get<StatuteNavigateResponse>(
      `/statutes/${slug}/navigate/${path}`,
    );
    return response.data;
  },

  /**
   * The reader's document fetch: the AKN 3.0 XML plus the paywall marker read
   * from the response headers (see the contract block above). `partial: null`
   * means "render the full document exactly as always" — the off-switch
   * state, a paid caller, a small statute, and unexposed headers are all,
   * deliberately, the same case.
   */
  getAknDocument: fetchAknDocument,

  /**
   * Export statute as AKN 3.0 XML string — the raw-string view of
   * {@link statutesApi.getAknDocument} (one request implementation), kept for
   * the file-download consumers (the admin export button) that only ever want
   * the bytes.
   */
  exportAkn: async (slug: string): Promise<string> =>
    (await fetchAknDocument(slug)).xml,

  /**
   * The AKN outline: every element of the document in reading order — eId,
   * type, number, title, depth — with a per-entry `locked` flag and the
   * document's true section count. No body text. Public route (no token
   * required); an authenticated twin exists at `/statutes/{slug}/akn/outline`
   * with the identical response.
   */
  getAknOutline: async (slug: string): Promise<StatuteOutlineResponse> => {
    const response = await apiClient.get<StatuteOutlineResponse>(
      `/public/statutes/${slug}/akn/outline`,
    );
    return response.data;
  },
};

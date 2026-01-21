import { useEffect, useRef } from 'react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { casesApi } from '@/lib/api/cases';
import type { CaseDetail } from '@/types/case';

interface UseCaseMentionTooltipsOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  enabled?: boolean;
  content?: string | null;
}

// =============================================================================
// Cache Implementation
// =============================================================================

interface CacheEntry {
  data: CaseDetail;
  timestamp: number;
}

const caseCache = new Map<string, CacheEntry | Promise<CaseDetail | null>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchCaseWithCache(slug: string): Promise<CaseDetail | null> {
  const cached = caseCache.get(slug);

  // Return cached data if fresh
  if (cached && 'data' in cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Return pending promise if request in flight
  if (cached instanceof Promise) {
    return cached;
  }

  // Fetch and cache
  const promise = casesApi
    .getBySlug(slug)
    .then((res) => {
      if (res.data) {
        caseCache.set(slug, { data: res.data, timestamp: Date.now() });
        return res.data;
      }
      caseCache.delete(slug);
      return null;
    })
    .catch(() => {
      caseCache.delete(slug);
      return null;
    });

  caseCache.set(slug, promise);
  return promise;
}

// =============================================================================
// Helper Functions
// =============================================================================

function extractSlug(mention: HTMLAnchorElement): string | null {
  // Try data attribute first (new format)
  const dataSlug = mention.getAttribute('data-case-slug');
  if (dataSlug) return dataSlug;

  // Fallback to href parsing (legacy format)
  const href = mention.getAttribute('href');
  if (href) {
    const match = href.match(/\/cases\/([^/?#]+)/);
    if (match) return match[1];
  }

  return null;
}

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// =============================================================================
// Render Functions
// =============================================================================

function renderLoadingState(): string {
  return `
    <div class="case-preview-tooltip__loading">
      <svg class="case-preview-tooltip__spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
      </svg>
      <span>Loading case...</span>
    </div>
  `;
}

function renderErrorState(): string {
  return `
    <div class="case-preview-tooltip__error">
      Unable to load case details
    </div>
  `;
}

function renderRichContent(caseData: CaseDetail): string {
  // Get content: prefer principles, fallback to excerpt
  const rawContent = caseData.principles
    ? stripHtml(caseData.principles)
    : caseData.excerpt || '';
  const content = truncateText(rawContent, 200);

  // Build meta items
  const metaItems: string[] = [];

  if (caseData.court?.abbreviation || caseData.court?.name) {
    metaItems.push(`
      <span class="case-preview-tooltip__meta-item">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
        </svg>
        ${escapeHtml(caseData.court.abbreviation || caseData.court.name)}
      </span>
    `);
  }

  if (caseData.judgment_date) {
    metaItems.push(`
      <span class="case-preview-tooltip__meta-item">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        ${formatDate(caseData.judgment_date)}
      </span>
    `);
  }

  return `
    <div class="case-preview-tooltip">
      <div class="case-preview-tooltip__header">${escapeHtml(caseData.title)}</div>
      ${metaItems.length > 0 ? `<div class="case-preview-tooltip__meta">${metaItems.join('')}</div>` : ''}
      ${content ? `<div class="case-preview-tooltip__content">${escapeHtml(content)}</div>` : ''}
      <div class="case-preview-tooltip__footer">Click to view full case</div>
    </div>
  `;
}

// =============================================================================
// Main Hook
// =============================================================================

/**
 * Attaches hover tooltips to case mention elements within a container.
 * Shows rich case details (title, court, principles) when hovering over @case mention badges.
 * Includes loading state and caching for optimal UX.
 */
export function useCaseMentionTooltips({
  containerRef,
  enabled = true,
  content,
}: UseCaseMentionTooltipsOptions) {
  const tippyInstancesRef = useRef<TippyInstance[]>([]);

  useEffect(() => {
    if (!enabled || !containerRef.current || !content) return;

    // Small delay to ensure DOM is rendered after dangerouslySetInnerHTML
    const timeoutId = setTimeout(() => {
      if (!containerRef.current) return;

      const mentions = containerRef.current.querySelectorAll<HTMLAnchorElement>(
        'a[data-type="case-mention"], a.case-mention'
      );

      // Destroy any existing instances first
      tippyInstancesRef.current.forEach((instance) => instance.destroy());

      const instances = Array.from(mentions).map((mention) => {
        // Skip if already has a tippy instance
        if ((mention as HTMLElement & { _tippy?: TippyInstance })._tippy) {
          return (mention as HTMLElement & { _tippy: TippyInstance })._tippy;
        }

        const slug = extractSlug(mention);

        return tippy(mention, {
          content: renderLoadingState(),
          allowHTML: true,
          placement: 'top',
          delay: [400, 100],
          duration: [200, 150],
          arrow: true,
          theme: 'case-mention-tooltip',
          interactive: true,
          interactiveBorder: 10,
          appendTo: document.body,
          onShow: async (instance) => {
            if (!slug) {
              instance.setContent(renderErrorState());
              return;
            }

            // Check if we already have cached data
            const cached = caseCache.get(slug);
            if (cached && 'data' in cached && Date.now() - cached.timestamp < CACHE_TTL) {
              instance.setContent(renderRichContent(cached.data));
              return;
            }

            // Show loading state and fetch
            instance.setContent(renderLoadingState());
            const caseData = await fetchCaseWithCache(slug);

            if (caseData) {
              instance.setContent(renderRichContent(caseData));
            } else {
              instance.setContent(renderErrorState());
            }
          },
        });
      });

      tippyInstancesRef.current = instances;
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      tippyInstancesRef.current.forEach((instance) => instance.destroy());
      tippyInstancesRef.current = [];
    };
  }, [containerRef, enabled, content]);
}

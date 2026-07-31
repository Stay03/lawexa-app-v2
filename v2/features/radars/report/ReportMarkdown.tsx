'use client';

import { memo } from 'react';
import Link from 'next/link';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import { getAppUrl } from '@/lib/constants/seo';

/**
 * ReportMarkdown — the scan report's markdown body.
 *
 * Static content (the report never streams), so this is a plain
 * `react-markdown` render — no block pipeline needed — styled entirely by
 * `report.css`'s `.report-prose` grammar. Two component overrides:
 *
 *  `a`      SSR-SAFE link routing. v1 resolved in-app links by comparing
 *           against `window.location.origin`, which silently renders every
 *           in-app link as external during SSR (the study's finding). Here
 *           the app origin comes from `getAppUrl()` — an env constant that
 *           exists on both sides. Three-way classification:
 *             app       `/…` paths and absolute URLs on our origin →
 *                       `next/link` navigation;
 *             external  absolute http(s) URLs elsewhere → new tab, safe rel;
 *             text      everything else — bare relative refs (`foo`),
 *                       fragments (`#s2`), and non-web schemes the agent
 *                       sometimes emits. Rendered as PLAIN TEXT: the words
 *                       stay readable, and no `_blank` tab is ever minted
 *                       for a target that cannot resolve.
 *  `table`  every table renders inside an `overflow-x-auto` wrapper, so a
 *           wide comparison table scrolls in place instead of breaking the
 *           reading column.
 */

const REMARK_PLUGINS = [remarkBreaks, remarkGfm];

type LinkTarget =
  | { kind: 'app'; path: string }
  | { kind: 'external'; href: string }
  | { kind: 'text' };

/** Classify an href — pure and window-free, so server and client render the
 *  same tree. See the docblock's three-way rule. */
function classifyHref(href: string): LinkTarget {
  if (href.startsWith('/')) return { kind: 'app', path: href };
  try {
    const parsed = new URL(href);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { kind: 'text' };
    }
    const appOrigin = new URL(getAppUrl()).origin;
    if (parsed.origin === appOrigin) {
      return {
        kind: 'app',
        path: `${parsed.pathname}${parsed.search}${parsed.hash}`,
      };
    }
    return { kind: 'external', href };
  } catch {
    // Bare relative refs and fragments — nothing here can resolve them.
    return { kind: 'text' };
  }
}

function ReportLink({
  href,
  children,
}: {
  href?: string;
  children?: React.ReactNode;
}) {
  if (!href) return <span>{children}</span>;
  const target = classifyHref(href);
  if (target.kind === 'app') {
    return <Link href={target.path}>{children}</Link>;
  }
  if (target.kind === 'external') {
    return (
      <a href={target.href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return <span>{children}</span>;
}

/** Stable module-level overrides — a fresh object per render defeats memo. */
const MARKDOWN_COMPONENTS: Components = {
  a: ({ href, children }) => <ReportLink href={href}>{children}</ReportLink>,
  table: ({ children }) => (
    <div className="report-table">
      <table>{children}</table>
    </div>
  ),
};

export const ReportMarkdown = memo(function ReportMarkdown({
  content,
}: {
  content: string;
}) {
  return (
    <div className="report-prose">
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        components={MARKDOWN_COMPONENTS}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

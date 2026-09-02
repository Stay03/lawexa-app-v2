'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Check, Link2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useShareUrl } from '@/v2/features/sharing/useShareUrl';

/**
 * SectionLink — the "copy a link to this section" affordance on section
 * headings, minting the citation path (`/statutes/{slug}/section-54`).
 *
 * ── WHY A CONTEXT ───────────────────────────────────────────────────────────
 * The renderer below `AknBlockView` is plain prop-free recursion over the
 * parsed DOM — threading the slug and the citable-section map through every
 * call would bend the whole renderer around one affordance. The document host
 * provides both once; a heading consumes them here. No provider (or a section
 * outside the citable map — a duplicate num, a dotted scheme) renders NOTHING:
 * the affordance only exists where the minted link would actually resolve.
 *
 * ── REVEAL RULES ────────────────────────────────────────────────────────────
 * Hover-capable fine pointers get the docs-site grammar: invisible until the
 * heading is hovered or focused (the CSS lives in `statute-document.css`).
 * Touch gets the same icon ALWAYS visible, quiet — a long-press mint was
 * considered and rejected: on iOS the press is claimed by text selection and
 * the callout, so a reliable long-press needs timer-and-preventDefault
 * machinery that breaks selection — a hack, not an affordance. Either way the
 * slot's width is reserved in the line, so revealing the icon never shifts a
 * glyph of the heading.
 *
 * The copied confirmation lives IN the control, deliberately: the icon flips
 * to the gold check and HOLDS it on a soft pill for the reset timer's whole
 * beat, the `aria-label` flips to "Link copied", and the document host's ONE
 * shared polite live region (via `announce` on the context — not a region per
 * section) says it aloud. Nothing floats outside the control: body blocks run
 * under `content-visibility: auto`, whose paint containment clips anything
 * that escapes the block's box — a chip above the first section's heading
 * would paint as nothing. The reset timer is re-armed per click — never
 * stacked — and cleared on unmount. Clipboard denial (or an insecure origin,
 * where `navigator.clipboard` does not exist) fails silent, the in-repo rule.
 */

export interface SectionLinkInfo {
  /** The citation path segment this section mints — `section-54`. */
  path: string;
  /** The human reference — `section 54` — for the accessible label. */
  label: string;
}

export interface SectionLinkContextValue {
  slug: string;
  /** Section block anchor id → mintable link. Only unambiguous citable
   *  sections are present (`indexSections` — first holder of a num wins). */
  links: ReadonlyMap<string, SectionLinkInfo>;
  /** Say it aloud through the document host's ONE shared polite live region —
   *  a region per section would be hundreds of empty live regions. */
  announce: (message: string) => void;
}

export const SectionLinkContext = createContext<SectionLinkContextValue | null>(
  null,
);

export function SectionCopyLink({ anchorId }: { anchorId: string }) {
  /* An ambassador's code rides the link they copy, so a signup from it credits
     them. Everybody else copies exactly what they copied before. */
  const shareUrl = useShareUrl();

  const context = useContext(SectionLinkContext);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const info = context?.links.get(anchorId);
  if (!context || !info) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        shareUrl(`${window.location.origin}/statutes/${context.slug}/${info.path}`),
      );
      setCopied(true);
      context.announce('Link copied');
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setCopied(false);
      }, 2000);
    } catch {
      // No clipboard permission — nothing to report.
    }
  };

  return (
    <span className="akn-copy-slot">
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? 'Link copied' : `Copy link to ${info.label}`}
        data-copied={copied || undefined}
        className={cn('akn-copy v2-interactive', FOCUS_RING)}
      >
        {copied ? (
          <Check aria-hidden className="size-3.5 text-primary" />
        ) : (
          <Link2 aria-hidden className="size-3.5" />
        )}
      </button>
    </span>
  );
}

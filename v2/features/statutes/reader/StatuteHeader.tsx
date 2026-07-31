'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Link2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { StatuteDetail } from '@/types/statute';
import { FlagIcon } from '@/v2/shell/FlagIcon';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { StatuteBookmarkButton } from '../bookmark/StatuteBookmarkButton';
import {
  formatStatuteDate,
  statuteStatusTone,
  toAlpha2,
  type StatuteStatusTone,
} from '../statute-row-model';

/**
 * StatuteHeader — the reader's heading block, in the case-document header
 * grammar: identity only, each fact exactly once.
 *
 *   breadcrumb   ← Statutes (back to the library)
 *   kicker       flag · country · year · document type — provenance first
 *   title        the Act's name, in the reading serif
 *   designation  the short title ("Act 459") — a reference string, sans
 *   status       a REAL badge: a repealed Act must look repealed before a
 *                single provision is read (colour + word, never colour-only)
 *   meta         commencement date, when known
 *   actions      copy-link, bookmark
 *
 * The long title ("AN ACT to …") is deliberately NOT here: it opens the
 * document itself (the AKN preface renders it), and a fact lives in one
 * place. v1 printed the preamble in the header AND let the XML preface render
 * it again — the reader saw the enacting formula twice.
 */

const STATUS_BADGE: Record<StatuteStatusTone, string> = {
  neutral: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  caution: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  negative: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

export function StatuteHeader({ detail }: { detail: StatuteDetail }) {
  const countryCode = toAlpha2(detail.country?.code, detail.country?.abbreviation);
  const tone = statuteStatusTone(detail.status);
  const commenced = formatStatuteDate(detail.commencement_date);
  const documentType = formatDocumentType(detail.document_type);

  return (
    <header className="flex flex-col gap-3 border-b border-border/60 pb-6">
      <p>
        <Link
          href="/statutes"
          className={cn(
            'v2-interactive inline-flex min-h-8 items-center gap-1.5 rounded-full pr-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
            FOCUS_RING,
          )}
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          Statutes
        </Link>
      </p>

      {/* Provenance first — where, when, and what kind of instrument. */}
      <p className="doc-kicker flex flex-wrap items-center gap-x-2 gap-y-1">
        {countryCode ? (
          <FlagIcon
            code={countryCode}
            title={detail.country?.name ?? undefined}
            className="-mt-px"
          />
        ) : null}
        {detail.country?.name ? <span>{detail.country.name}</span> : null}
        {detail.country?.name ? <Dot /> : null}
        <span className="tabular-nums">{detail.year}</span>
        {documentType ? (
          <>
            <Dot />
            <span>{documentType}</span>
          </>
        ) : null}
      </p>

      <h1 className="doc-title text-foreground">{detail.title}</h1>

      {detail.short_title && detail.short_title !== detail.title ? (
        <p className="doc-citation">{detail.short_title}</p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            className={cn(
              'inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-medium',
              STATUS_BADGE[tone],
            )}
          >
            {detail.status_label || detail.status}
          </span>
          {commenced ? (
            <span className="text-xs text-muted-foreground">
              Commenced <span className="tabular-nums">{commenced}</span>
            </span>
          ) : null}
        </p>

        {/* What repealed it — the next fact a lawyer needs after seeing
            "Repealed": which instrument displaced this text, and when. */}
        {detail.repealed_by?.title ? (
          <p className="text-xs text-muted-foreground">
            Repealed by{' '}
            <span className="text-foreground">{detail.repealed_by.title}</span>
            {formatStatuteDate(detail.repealed_by.date) ? (
              <>
                {' · '}
                <span className="tabular-nums">
                  {formatStatuteDate(detail.repealed_by.date)}
                </span>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CopyLinkButton slug={detail.slug} />
        <StatuteBookmarkButton
          statuteId={detail.id}
          isBookmarked={detail.is_bookmarked}
          count={detail.bookmarks_count}
          variant="full"
        />
      </div>
    </header>
  );
}

/** 'act' → 'Act'. Tolerates types newer than this build. */
function formatDocumentType(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).replace(/_/g, ' ');
}

/**
 * Copy the statute's clean canonical URL. The confirmation lives IN the
 * control (icon flips to a check for two seconds) — the case page's
 * copy-action rule — and the label swap is a POLITE live region, so a screen
 * reader hears "Link copied" without being interrupted. The reset timer is
 * RE-ARMED on each click (never stacked, so a rapid second copy still gets
 * its full two seconds) and cleared on unmount. Clipboard denial fails
 * silent: the address bar still has the link.
 */
function CopyLinkButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/statutes/${slug}`,
      );
      setCopied(true);
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
    <button
      type="button"
      onClick={() => void copy()}
      className={cn(
        'v2-interactive inline-flex min-h-9 items-center gap-2 rounded-full border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
        FOCUS_RING,
      )}
    >
      {copied ? (
        <Check aria-hidden className="size-4 text-primary" />
      ) : (
        <Link2 aria-hidden className="size-4" />
      )}
      <span aria-live="polite">{copied ? 'Link copied' : 'Copy link'}</span>
    </button>
  );
}

function Dot() {
  return (
    <span aria-hidden className="text-muted-foreground/40">
      ·
    </span>
  );
}

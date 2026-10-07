'use client';

import Link from 'next/link';
import { ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatuteDetail } from '@/types/statute';
import { FlagIcon } from '@/v2/shell/FlagIcon';
import { AddToFolderButton } from '@/v2/features/folders/picker/AddToFolderButton';
import { StatuteBookmarkButton } from '../bookmark/StatuteBookmarkButton';
import {
  formatStatuteDate,
  statuteStatusTone,
  toAlpha2,
  type StatuteStatusTone,
} from '../statute-row-model';
import { ShareButton } from '@/v2/features/sharing/ShareButton';
import { NotesButton } from '../notes/NotesButton';
import { incompleteNotice, statuteSource } from './statute-source';

/**
 * StatuteHeader — the reader's heading block, in the case-document header
 * grammar: identity only, each fact exactly once.
 *
 *   kicker       flag · country · year · document type — provenance first
 *   title        the Act's name, in the reading serif
 *   designation  the short title ("Act 459") — a reference string, sans
 *   status       a REAL badge: a repealed Act must look repealed before a
 *                single provision is read (colour + word, never colour-only)
 *   source       where the text was taken from (Official Gazette … Unofficial
 *                reproduction) and the source note under it, when recorded
 *   meta         commencement date, when known
 *   incomplete   a notice saying what is missing, when the text is not whole
 *   actions      copy-link, bookmark, add-to-folder
 *
 * The long title ("AN ACT to …") is deliberately NOT here: it opens the
 * document itself (the AKN preface renders it), and a fact lives in one
 * place. v1 printed the preamble in the header AND let the XML preface render
 * it again — the reader saw the enacting formula twice.
 *
 * ── THE WAY BACK LEFT THIS BLOCK (phase 7) ─────────────────────────────────
 * It opened with an "← Statutes" chip at y76, under a bar that carried the
 * hamburger and, in its centre, the SHORT designation ("Act 9") while the title
 * below said the Act's full name. One instrument, two names, and two ways up.
 * The shell's bar now owns the back arrow (`v2/shell/pushed-route.ts`) and this
 * block owns the name, once.
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
  const source = statuteSource(detail);
  const incomplete = incompleteNotice(detail);

  return (
    <header className="flex flex-col gap-3 border-b border-border/60 pb-6">
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
          {source ? (
            <span
              className={cn(
                'inline-flex min-h-6 items-center gap-1 rounded-full border px-2.5 text-xs font-medium',
                source.official
                  ? 'border-border text-foreground'
                  : 'border-amber-500/40 text-amber-700 dark:text-amber-400',
              )}
            >
              {source.official ? (
                <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
              ) : (
                <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
              )}
              <span className="sr-only">Source: </span>
              {source.label}
            </span>
          ) : null}
          {commenced ? (
            <span className="text-xs text-muted-foreground">
              Commenced <span className="tabular-nums">{commenced}</span>
            </span>
          ) : null}
        </p>

        {/* What repealed it — the next fact a lawyer needs after seeing
            "Repealed": which instrument displaced this text, and when. When
            that instrument is in the library, its name opens it. */}
        {detail.repealed_by?.title ? (
          <p className="text-xs text-muted-foreground">
            Repealed by{' '}
            {detail.repealed_by.statute?.slug ? (
              <Link
                href={`/statutes/${detail.repealed_by.statute.slug}`}
                className="rounded-sm text-foreground underline decoration-primary/45 decoration-dotted underline-offset-4 transition-colors hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {detail.repealed_by.title}
              </Link>
            ) : (
              <span className="text-foreground">{detail.repealed_by.title}</span>
            )}
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

        {/* The source note: publisher, URL or file name, gazette number and date. */}
        {source?.note ? (
          <p className="text-xs text-muted-foreground">
            Source: <span className="break-words text-foreground">{source.note}</span>
          </p>
        ) : null}
      </div>

      {/* Said before the text, not after it: a lawyer must know what is
          missing before relying on what is there. */}
      {incomplete ? (
        <div
          role="note"
          className="flex gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="font-medium text-amber-800 dark:text-amber-300">Incomplete text</p>
            <p className="break-words text-foreground/90">{incomplete}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <ShareButton
          path={`/statutes/${detail.slug}`}
          title={detail.title}
          label="Share this statute"
        />
        <StatuteBookmarkButton
          statuteId={detail.id}
          isBookmarked={detail.is_bookmarked}
          count={detail.bookmarks_count}
          variant="full"
        />
        <AddToFolderButton target={{ type: 'statute', contentId: detail.id }} />
        <NotesButton />
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

function Dot() {
  return (
    <span aria-hidden className="text-muted-foreground/40">
      ·
    </span>
  );
}

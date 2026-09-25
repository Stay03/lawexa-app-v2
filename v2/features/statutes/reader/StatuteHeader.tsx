'use client';

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

/**
 * StatuteHeader — the reader's heading block, in the case-document header
 * grammar: identity only, each fact exactly once.
 *
 *   kicker       flag · country · year · document type — provenance first
 *   title        the Act's name, in the reading serif
 *   designation  the short title ("Act 459") — a reference string, sans
 *   status       a REAL badge: a repealed Act must look repealed before a
 *                single provision is read (colour + word, never colour-only)
 *   meta         commencement date, when known
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

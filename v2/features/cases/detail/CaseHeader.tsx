'use client';

import { useState, type ReactNode } from 'react';
import { Check, Copy, ShieldCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { CaseOutcome } from '@/types/case';
import { FlagIcon } from '@/v2/shell/FlagIcon';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { formatCaseDate } from '../case-row-model';
import { sentenceCase } from './authorities';

/**
 * CaseHeader — the case page's heading block: provenance, name, citation,
 * topic, outcome and the actions row, each fact exactly once.
 *
 * ONE COMPONENT FOR THE PAGE AND ITS INSTANT FRAME (Stay, 20 October 2026,
 * 15:09Z: "The loading is jumpy because the positioning of things changes").
 * The frame a tap paints (`CaseFallback.tsx`) used to draw its own kicker and
 * name over bars sized by guesswork, so the loaded page moved everything under
 * them. Both now draw this block from the same facts: the frame from the
 * tapped row, the page from the case. A fact the row does not carry is left
 * out of both until the case arrives, so only it can add height.
 */

export interface CaseHeaderFacts {
  countryCode: string | null;
  countryName: string | null;
  court: string | null;
  judgmentDate: string | null;
  isVerified: boolean;
  /** The readable name, and the source form for the hover title. */
  name: string;
  rawTitle: string;
  citation: string | null;
  suitNo: string | null;
  topic: string | null;
  outcome: string | null;
}

export function CaseHeader({ facts, actions }: { facts: CaseHeaderFacts; actions: ReactNode }) {
  const date = formatCaseDate(facts.judgmentDate, 'long');
  return (
    <header className="flex flex-col gap-3 border-b border-border/60 pb-6">
      {/* Provenance first — where and when, in the label voice. */}
      <p className="doc-kicker flex flex-wrap items-center gap-x-2 gap-y-1">
        {facts.countryCode ? (
          <FlagIcon code={facts.countryCode} title={facts.countryName ?? undefined} className="-mt-px" />
        ) : null}
        {facts.court ? <span>{facts.court}</span> : null}
        {date ? (
          <>
            {facts.court ? (
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
            ) : null}
            <span className="tabular-nums">{date}</span>
          </>
        ) : null}
        {/* Verified last, and only when true: it qualifies where the judgment
            came from, which is what the rest of this line is about.
            THE READER IS TOLD OUR RESEARCHERS VERIFIED IT, never which outside
            provider did. The owner's instruction, 3 September 2026. The
            supplier's name lives on the admin duplicates row and nowhere a
            reader can reach. */}
        {facts.isVerified ? (
          <>
            {facts.court || date ? (
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
            ) : null}
            <span
              className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"
              title="Verified by our researchers"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Verified report
            </span>
          </>
        ) : null}
      </p>

      <h1 className="doc-title text-foreground" title={facts.rawTitle}>
        {facts.name}
      </h1>

      {facts.citation || facts.suitNo ? (
        // No dot between the citation and the suit number: at phone width the
        // line wraps there, and the dot then opened the second line on its
        // own. The copy icon and the word "Suit" already mark the change.
        <p className="doc-citation flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {facts.citation ? <CopyCitation name={facts.name} citation={facts.citation} /> : null}
          {facts.suitNo ? <span>Suit {facts.suitNo}</span> : null}
        </p>
      ) : null}

      {/* The topic — what the case is ABOUT, in one editorial line. */}
      {facts.topic ? (
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {sentenceCase(facts.topic)}
        </p>
      ) : null}

      {facts.outcome ? (
        <p>
          {/* The disposition — the first question a lawyer asks, answered
              before the reading starts. Gold because it is THE answer;
              neutral in tone because which side "won" depends on your side. */}
          <span className="inline-flex min-h-6 items-center rounded-full bg-primary/10 px-2.5 text-xs font-medium text-primary">
            {outcomeLabel(facts.outcome)}
          </span>
        </p>
      ) : null}

      {actions}
    </header>
  );
}

const OUTCOME_LABELS: Record<CaseOutcome, string> = {
  appeal_allowed: 'Appeal allowed',
  appeal_dismissed: 'Appeal dismissed',
  appeal_allowed_in_part: 'Appeal allowed in part',
  retrial_ordered: 'Retrial ordered',
  convicted: 'Convicted',
  acquitted: 'Acquitted',
  judgment_for_plaintiff: 'Judgment for plaintiff',
  judgment_for_defendant: 'Judgment for defendant',
  dismissed: 'Dismissed',
  struck_out: 'Struck out',
  application_granted: 'Application granted',
  application_refused: 'Application refused',
};

/** Label an outcome, tolerating enum values newer than this build. */
export function outcomeLabel(outcome: string): string {
  const known = OUTCOME_LABELS[outcome as CaseOutcome];
  if (known) return known;
  return outcome
    .split('_')
    .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/**
 * The citation line as a one-click copy — but what lands on the clipboard is
 * the FULL reference a lawyer retypes into a brief: "{name} {citation}"
 * (owner, July 31 — a bare citation still has to be reunited with its case
 * name by hand). The control shows the citation alone; the confirmation lives
 * IN it (icon flips to a check for two seconds), the same rule as the Share
 * action's "Link copied". Clipboard denial fails silent: the text is still
 * selectable.
 */
function CopyCitation({ name, citation }: { name: string; citation: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${name} ${citation}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard permission — nothing to report, the text selects fine.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? 'Case name and citation copied' : 'Copy the case name and citation'}
      className={cn(
        'v2-interactive group/copy inline-flex items-center gap-1.5 rounded-md py-0.5 text-left transition-colors hover:text-foreground',
        FOCUS_RING,
      )}
    >
      {citation}
      {copied ? (
        <Check aria-hidden className="size-3.5 shrink-0 text-primary" />
      ) : (
        <Copy
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover/copy:text-muted-foreground"
        />
      )}
    </button>
  );
}

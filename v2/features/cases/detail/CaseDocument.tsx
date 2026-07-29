'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils';
import { citedEdgeToDisplay, relatedToDisplay } from '@/lib/utils/related-cases';
import type {
  CaseDetail,
  CaseOutcome,
  CoramRole,
  CourtHistoryStep,
  ReportPrinciple,
  StatuteCitedEdge,
} from '@/types/case';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { formatCaseName } from '../case-name';
import { formatCaseDate } from '../case-row-model';
import { CaseActions } from './CaseActions';
import { CaseText } from './case-text';
import { RelatedCaseList } from './RelatedCases';
import { ViewLimitNotice } from './states';
import './case-document.css';

/**
 * CaseDocument — THE case reading surface. Singular, on purpose (the July-25
 * study: v1 rendered one case three disagreeing ways; the toggle and both
 * alternates are gone — see the phase-4 plan for the full record).
 *
 * ── THE JULY-29 REWORK (owner review + the backend's July contract) ─────────
 *  • THE HEADING IS A NAME, NOT A WALL. The all-caps title with the citation
 *    fused in is split: a mixed-case case name (`formatCaseName`, source form
 *    on hover), the citation on its own quiet line, and — new — the OUTCOME as
 *    a badge beside the meta, because "did the appeal succeed?" is the first
 *    question a lawyer asks and the API now answers it.
 *  • THE JUDGMENT'S OWN STRUCTURE RENDERS. The enrichment contract
 *    (case-structures-and-enrichment.md) always loads `report_principles`,
 *    `statutes_cited` and `court_history` on the show endpoint, so the page now
 *    has: verbatim principles with their tag / ratio-obiter mark / attributed
 *    judge (falling back to the flat `principles` string on the unenriched
 *    corpus), the procedural chain as an ordered history, and cited statutes
 *    beside cited cases.
 *  • THE CORAM CARRIES ITS ROLES — "(lead)", "(dissenting)" — and judge names
 *    are cased like names.
 *  • VIEW COUNTS ARE GONE everywhere on the reading surface (owner).
 *
 * ── NO BOXES ────────────────────────────────────────────────────────────────
 * Sections are told apart by space and a quiet heading, never by a border — the
 * standing rule from the home redesign.
 */

/** Human labels for the outcome enum. Unknown values title-case gracefully. */
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

const ROLE_LABELS: Record<CoramRole, string> = {
  lead: 'lead',
  concurring: 'concurring',
  dissenting: 'dissenting',
};

export function CaseDocument({ detail }: { detail: CaseDetail }) {
  const raw = detail.display_title || detail.title;
  const name = formatCaseName(raw);
  const date = formatCaseDate(detail.judgment_date, 'long');
  const isLimited = detail.limit_exceeded === true;

  const similar = (detail.similar_cases ?? []).map(relatedToDisplay);
  const cited = (detail.cited_cases ?? []).map(citedEdgeToDisplay);
  const citedBy = (detail.cited_by ?? []).map(relatedToDisplay);

  const principles = [...(detail.report_principles ?? [])].sort(
    (a, b) => a.order - b.order,
  );
  const statutes = detail.statutes_cited ?? [];
  const history = [...(detail.court_history ?? [])].sort((a, b) => a.order - b.order);

  // The body is the summary; the excerpt is the honest fallback when a case has
  // not been written up yet. Neither is invented when both are absent.
  const summary = detail.body?.trim() || detail.excerpt?.trim() || '';

  /** The heading's meta line, in reading order, with the gaps closed up. */
  const meta = [detail.court?.name, detail.country?.name, date].filter(
    (part): part is string => Boolean(part),
  );
  /** The facts line: outcome rides as a BADGE; these ride as quiet text. */
  const factParts = [
    detail.suit_no ? `Suit ${detail.suit_no}` : null,
    detail.origin_state || null,
  ].filter((part): part is string => Boolean(part));

  return (
    <article className="flex flex-col gap-8">
      {/* ── Heading block ───────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="doc-title text-foreground" title={raw}>
            {name}
          </h1>
          {detail.citation ? (
            <p className="doc-citation">{detail.citation}</p>
          ) : null}
        </div>

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {/* Keyed by POSITION, not by value: a court and a country can carry
              the same string, and two identical keys in one list is a real bug
              hiding behind an unlikely input. */}
          {meta.map((part, index) => (
            <span key={index} className="inline-flex items-center gap-2">
              {index > 0 ? (
                <span aria-hidden className="text-muted-foreground/40">
                  ·
                </span>
              ) : null}
              {part}
            </span>
          ))}
        </p>

        {detail.outcome || factParts.length > 0 ? (
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-muted-foreground">
            {detail.outcome ? (
              // The disposition — the one fact a scanning lawyer wants first.
              // Gold-tinted because it is THE answer, not a decoration; the
              // tone is neutral on purpose (which side "won" depends on which
              // side you were).
              <span className="inline-flex min-h-6 items-center rounded-full bg-primary/10 px-2.5 font-medium text-primary">
                {outcomeLabel(detail.outcome)}
              </span>
            ) : null}
            {factParts.map((part, index) => (
              <span key={index} className="inline-flex items-center gap-2.5">
                {index > 0 || detail.outcome ? (
                  <span aria-hidden className="text-muted-foreground/40">
                    ·
                  </span>
                ) : null}
                {part}
              </span>
            ))}
          </p>
        ) : null}

        {detail.tags && detail.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {detail.tags.map((tag) => (
              <li key={tag}>
                {/* A tag is a FILTER, so it is a real link to the filtered list —
                    shareable, middle-clickable, and announced as a link. */}
                <Link
                  href={`/cases?tags=${encodeURIComponent(tag)}`}
                  className={cn(
                    'v2-interactive inline-flex min-h-7 items-center rounded-full bg-secondary px-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground',
                    FOCUS_RING,
                  )}
                >
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <CaseActions
          caseId={detail.id}
          slug={detail.slug}
          title={name}
          isBookmarked={detail.is_bookmarked}
          bookmarksCount={detail.bookmarks_count}
          hasFullReport={detail.has_full_report === true && !isLimited}
        />
      </header>

      {/* ── Bench and topic — one quiet line each, above the reading ────── */}
      {detail.judges.length > 0 || detail.topic ? (
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          {detail.judges.length > 0 ? (
            <p>
              <span className="font-medium text-foreground">Before: </span>
              {detail.judges.map((judge, index) => (
                <span key={judge.id}>
                  {index > 0 ? ', ' : ''}
                  {formatCaseName(judge.name)}
                  {judge.role ? (
                    <span className="text-muted-foreground/70">
                      {' '}
                      ({ROLE_LABELS[judge.role]})
                    </span>
                  ) : null}
                </span>
              ))}
            </p>
          ) : null}
          {detail.topic ? (
            <p>
              <span className="font-medium text-foreground">Topic: </span>
              {detail.topic}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── The holding: structured principles when enriched, flat text on
             the legacy corpus. Never both. ─────────────────────────────── */}
      {principles.length > 0 ? (
        <StructuredPrinciples principles={principles} />
      ) : detail.principles?.trim() ? (
        <section aria-label="Legal principles" className="flex flex-col gap-2">
          <h2 className="doc-heading">Legal principles</h2>
          <div className="doc-holding">
            <div className="doc-prose">
              <CaseText value={detail.principles} />
            </div>
          </div>
        </section>
      ) : null}

      {/* ── The summary, or the wall ────────────────────────────────────── */}
      <section aria-label="Case summary" className="flex flex-col gap-2">
        <h2 className="doc-heading">Case summary</h2>
        {isLimited ? (
          <ViewLimitNotice message={detail.limit_message} />
        ) : summary ? (
          <div className="doc-prose">
            <CaseText value={summary} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This case has no written summary yet.
          </p>
        )}
      </section>

      {/* ── The procedural chain ────────────────────────────────────────── */}
      {history.length > 0 ? <CaseHistory steps={history} /> : null}

      {/* ── Authorities: statutes beside cases ──────────────────────────── */}
      {statutes.length > 0 || similar.length > 0 || cited.length > 0 || citedBy.length > 0 ? (
        <div className="flex flex-col gap-7">
          {statutes.length > 0 ? <StatutesCited statutes={statutes} /> : null}
          <RelatedCaseList
            title="Cases cited"
            description="Authorities this judgment relied on."
            cases={cited}
          />
          <RelatedCaseList
            title="Cited by"
            description="Later judgments that cite this one."
            cases={citedBy}
          />
          <RelatedCaseList
            title="Similar cases"
            description="Cases on comparable facts or points of law."
            cases={similar}
          />
        </div>
      ) : null}
    </article>
  );
}

/**
 * The enrichment-era holding: each principle VERBATIM from the judgment, with
 * its subject tag, its ratio/obiter mark, and — when attributed — the judge who
 * said it. One gold rule spans the set; entries separate by space.
 *
 * `reviewed: false` rows only reach Researcher+ accounts (the server filters
 * them for everyone else), and they are BADGED rather than hidden — a reviewer
 * seeing unreviewed text unmarked would republish it by trusting it.
 */
function StructuredPrinciples({ principles }: { principles: ReportPrinciple[] }) {
  return (
    <section aria-label="Legal principles" className="flex flex-col gap-2">
      <h2 className="doc-heading">Legal principles</h2>
      <div className="doc-holding">
        <ol className="flex flex-col gap-5">
          {principles.map((principle) => (
            <li key={principle.id} className="flex flex-col gap-1.5">
              <div className="doc-prose">
                <CaseText value={principle.principle} />
              </div>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {principle.tag ? (
                  <span className="inline-flex min-h-5 items-center rounded-full bg-secondary px-2 text-[11px]">
                    {principle.tag}
                  </span>
                ) : null}
                {principle.type ? (
                  <span className="font-medium uppercase tracking-wide text-[10px] text-muted-foreground/80">
                    {principle.type === 'ratio' ? 'Ratio' : 'Obiter'}
                  </span>
                ) : null}
                {principle.judge ? (
                  <span>
                    Per {formatCaseName(principle.judge.name)}
                    {principle.judge.role ? ` (${ROLE_LABELS[principle.judge.role]})` : ''}
                  </span>
                ) : null}
                {!principle.reviewed ? (
                  <span className="inline-flex min-h-5 items-center rounded-full bg-amber-500/15 px-2 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    Unreviewed
                  </span>
                ) : null}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * The case's journey through the courts, in order. Linked steps navigate to the
 * earlier decision; unlinked steps render their label as text — same rule as an
 * unresolved citation.
 */
function CaseHistory({ steps }: { steps: CourtHistoryStep[] }) {
  return (
    <section aria-label="Case history" className="flex flex-col gap-1.5">
      <div className="px-1">
        <h2 className="doc-heading">Case history</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          How this case travelled through the courts.
        </p>
      </div>
      <ol className="flex flex-col">
        {steps.map((step, index) => {
          const linked = step.related_case_id !== null && step.slug;
          const label = linked
            ? formatCaseName(step.title || step.label || '')
            : step.label || '';
          const stepMeta = [
            linked ? step.court : null,
            step.decided_date ? formatCaseDate(step.decided_date) : null,
            step.outcome ? outcomeLabel(step.outcome) : null,
          ].filter((part): part is string => Boolean(part));

          const body = (
            <>
              {/* The chain mark: a numbered dot and, between steps, a hairline
                  spine — a timeline drawn with two elements, no library. */}
              <span className="flex flex-col items-center self-stretch">
                <span
                  aria-hidden
                  className="mt-3 flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-medium tabular-nums text-muted-foreground"
                >
                  {index + 1}
                </span>
                {index < steps.length - 1 ? (
                  <span aria-hidden className="w-px flex-1 bg-border/60" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 py-2">
                <span className="block text-sm text-foreground">{label}</span>
                {stepMeta.length > 0 ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {stepMeta.join(' · ')}
                  </span>
                ) : null}
              </span>
            </>
          );

          return (
            <li key={step.id} className="flex gap-3">
              {linked ? (
                <Link
                  href={`/cases/${step.slug}`}
                  className={cn(
                    'v2-interactive flex min-w-0 flex-1 gap-3 rounded-lg px-1 transition-colors hover:bg-secondary/50',
                    FOCUS_RING,
                  )}
                >
                  {body}
                </Link>
              ) : (
                <span className="flex min-w-0 flex-1 gap-3 px-1">{body}</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Statutes this judgment cited — linked when resolved, text when not. */
function StatutesCited({ statutes }: { statutes: StatuteCitedEdge[] }) {
  return (
    <section aria-label="Statutes cited" className="flex flex-col gap-1.5">
      <div className="px-1">
        <h2 className="doc-heading">Statutes cited</h2>
      </div>
      <ul className="flex flex-col divide-y divide-border/60">
        {statutes.map((edge) => {
          const text = edge.statute?.title || edge.raw || 'Unnamed statute';
          const body = (
            <>
              <span className="min-w-0 flex-1 text-sm text-foreground">{text}</span>
              {edge.provision ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {edge.provision}
                </span>
              ) : null}
            </>
          );
          return (
            <li key={edge.id}>
              {edge.statute ? (
                <Link
                  href={`/statutes/${edge.statute.slug}`}
                  className={cn(
                    'v2-interactive flex min-h-11 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/50',
                    FOCUS_RING,
                  )}
                >
                  {body}
                </Link>
              ) : (
                <span className="flex min-h-11 items-center gap-3 px-2 py-2.5">
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

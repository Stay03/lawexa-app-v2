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
import { FlagIcon } from '@/v2/shell/FlagIcon';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { formatCaseName } from '../case-name';
import { formatCaseDate, toAlpha2 } from '../case-row-model';
import { CaseActions } from './CaseActions';
import { CaseText } from './case-text';
import { RelatedCaseList } from './RelatedCases';
import { SectionHeading } from './SectionHeading';
import { ViewLimitNotice } from './states';
import './case-document.css';

/**
 * CaseDocument — THE case reading surface.
 *
 * ── THE JULY-29 FINESSE PASS (owner: "data scattered all over the place, no
 *    finesse") ────────────────────────────────────────────────────────────────
 * The honest criticism of the previous version: between the title and the first
 * word of law sat SEVEN rows of near-equal-weight data — citation, meta,
 * outcome, six tag chips, three buttons, a two-line bench, a topic line. Every
 * row shouted the same, so nothing led. The fix is an editorial page's oldest
 * discipline: the header carries ONLY what identifies the case, everything
 * descriptive moves to the end, and the whole page speaks two voices —
 *
 *   SANS CAPS  = structure (the kicker, every section label — one voice)
 *   SERIF      = the law (the name, the principles, the summary)
 *
 * HEADER now: kicker (flag · court · date) → name → citation + suit → outcome
 * badge → compact actions. Five quiet rows, each with one job.
 * END now: "About this case" — the bench (with coram roles), topic,
 * jurisdiction, tags — a definition list where reference data belongs. The
 * reader who wants it scrolls past the judgment to it; the reader who wants
 * the law meets it immediately.
 *
 * Everything else from the earlier rounds holds: structured principles with
 * the flat-string fallback, the procedural timeline, statutes beside cases,
 * treatment badges with the catch-all suppressed, text never rendered as HTML.
 */

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
  const countryCode = toAlpha2(detail.country?.code, detail.country?.abbreviation);

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

  return (
    <article className="flex flex-col gap-9">
      {/* ── Heading block: identity only. ───────────────────────────────── */}
      <header className="flex flex-col gap-3 border-b border-border/60 pb-6">
        {/* Provenance first — where and when, in the label voice. */}
        <p className="doc-kicker flex flex-wrap items-center gap-x-2 gap-y-1">
          {countryCode ? (
            <FlagIcon
              code={countryCode}
              title={detail.country?.name ?? undefined}
              className="-mt-px"
            />
          ) : null}
          {detail.court?.name ? <span>{detail.court.name}</span> : null}
          {date ? (
            <>
              {detail.court?.name ? (
                <span aria-hidden className="text-muted-foreground/40">
                  ·
                </span>
              ) : null}
              <span className="tabular-nums">{date}</span>
            </>
          ) : null}
        </p>

        <h1 className="doc-title text-foreground" title={raw}>
          {name}
        </h1>

        {detail.citation || detail.suit_no ? (
          <p className="doc-citation">
            {[detail.citation, detail.suit_no ? `Suit ${detail.suit_no}` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : null}

        {detail.outcome || detail.origin_state ? (
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {detail.outcome ? (
              // The disposition — the first question a lawyer asks, answered
              // before the reading starts. Gold because it is THE answer;
              // neutral in tone because which side "won" depends on your side.
              <span className="inline-flex min-h-6 items-center rounded-full bg-primary/10 px-2.5 font-medium text-primary">
                {outcomeLabel(detail.outcome)}
              </span>
            ) : null}
            {detail.origin_state ? <span>{detail.origin_state}</span> : null}
          </p>
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

      {/* ── The law. ────────────────────────────────────────────────────── */}
      {principles.length > 0 ? (
        <StructuredPrinciples principles={principles} />
      ) : detail.principles?.trim() ? (
        <section aria-label="Legal principles" className="flex flex-col gap-3">
          <SectionHeading label="Legal principles" />
          <div className="doc-holding">
            <div className="doc-prose">
              <CaseText value={detail.principles} />
            </div>
          </div>
        </section>
      ) : null}

      {/* ── What happened. ──────────────────────────────────────────────── */}
      <section aria-label="Case summary" className="flex flex-col gap-3">
        <SectionHeading label="Case summary" />
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

      {/* ── Depth: the chain, the authorities. ──────────────────────────── */}
      {history.length > 0 ? <CaseHistory steps={history} /> : null}

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

      {/* ── Reference data, where reference data belongs. ───────────────── */}
      <AboutThisCase detail={detail} countryCode={countryCode} />
    </article>
  );
}

/**
 * The end-of-document reference block — everything that used to crowd the
 * header (the bench, the topic, the jurisdiction, the tags), as a quiet
 * definition list. A reader consults this; nobody should have to climb over it.
 */
function AboutThisCase({
  detail,
  countryCode,
}: {
  detail: CaseDetail;
  countryCode: string | null;
}) {
  const hasBench = detail.judges.length > 0;
  const hasTags = !!detail.tags && detail.tags.length > 0;
  if (!hasBench && !detail.topic && !detail.country && !hasTags) return null;

  return (
    <section aria-label="About this case" className="flex flex-col gap-3">
      <SectionHeading label="About this case" />
      <dl className="flex flex-col gap-3">
        {hasBench ? (
          <AboutRow term={detail.judges.length === 1 ? 'Judge' : 'Coram'}>
            {detail.judges.map((judge, index) => (
              <span key={judge.id}>
                {index > 0 ? ', ' : ''}
                {formatCaseName(judge.name)}
                {judge.role ? (
                  <span className="text-muted-foreground">
                    {' '}
                    ({ROLE_LABELS[judge.role]})
                  </span>
                ) : null}
              </span>
            ))}
          </AboutRow>
        ) : null}

        {detail.topic ? <AboutRow term="Topic">{detail.topic}</AboutRow> : null}

        {detail.country ? (
          <AboutRow term="Jurisdiction">
            <span className="inline-flex items-center gap-1.5">
              {countryCode ? <FlagIcon code={countryCode} /> : null}
              {detail.country.name}
              {detail.origin_state ? ` — ${detail.origin_state}` : ''}
            </span>
          </AboutRow>
        ) : null}

        {hasTags ? (
          <AboutRow term="Tags">
            <span className="flex flex-wrap gap-1.5">
              {detail.tags!.map((tag) => (
                <Link
                  key={tag}
                  href={`/cases?tags=${encodeURIComponent(tag)}`}
                  className={cn(
                    'v2-interactive inline-flex min-h-7 items-center rounded-full bg-secondary px-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground',
                    FOCUS_RING,
                  )}
                >
                  {tag}
                </Link>
              ))}
            </span>
          </AboutRow>
        ) : null}
      </dl>
    </section>
  );
}

function AboutRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
      <dt className="w-24 shrink-0 pt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
        {term}
      </dt>
      <dd className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">
        {children}
      </dd>
    </div>
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
    <section aria-label="Legal principles" className="flex flex-col gap-3">
      <SectionHeading label="Legal principles" />
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
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
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
    <section aria-label="Case history" className="flex flex-col gap-3">
      <SectionHeading
        label="Case history"
        sub="How this case travelled through the courts."
      />
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
    <section aria-label="Statutes cited" className="flex flex-col gap-3">
      <SectionHeading label="Statutes cited" />
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

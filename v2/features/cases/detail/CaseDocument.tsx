'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatTreatment, relatedToDisplay } from '@/lib/utils/related-cases';
import type { RelatedCaseDisplay } from '@/lib/utils/related-cases';
import type {
  CaseDetail,
  CaseOutcome,
  CoramRole,
  CourtHistoryStep,
  ReportPrinciple,
} from '@/types/case';
import { FlagIcon } from '@/v2/shell/FlagIcon';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { firstCitation, formatCaseName } from '../case-name';
import { formatCaseDate, toAlpha2 } from '../case-row-model';
import {
  groupCitedCases,
  groupStatutes,
  lawTypeLabel,
  normalizeBench,
  sentenceCase,
} from './authorities';
import { AuthorityList, type AuthorityItem } from './AuthorityList';
import { CaseActions } from './CaseActions';
import { CaseText, caseTextParagraphs } from './case-text';
import type { OutlineSection } from './CaseOutline';
import { SectionHeading } from './SectionHeading';
import { ViewLimitNotice } from './states';
import './case-document.css';

/**
 * CaseDocument — THE case reading surface.
 *
 * ── THE JULY-30 REDESIGN (owner: "a complete redesign… the components and
 *    the design") ─────────────────────────────────────────────────────────────
 * The two-voice system stays — caps-tracked sans for structure, the serif for
 * the law — but the DATA now renders through designed components instead of
 * bare rows:
 *
 *   PRINCIPLES   numbered entries with a hanging gold numeral and ONE caption
 *                line (Ratio · tag · Per Judge). The law report's holdings
 *                list, not an undifferentiated serif column.
 *   STATUTES     grouped one-row-per-Act with provisions collected —
 *                27 sentence-level edges become ~9 rows (`authorities.ts`).
 *   CASES CITED  raw fused citations split into name + report reference,
 *                parallel citations merged, sixty-row lists folded.
 *   EVERY LIST   one row grammar (`AuthorityList`), and every row goes
 *                somewhere: chevron = we hold it, search = pre-filled library
 *                search (owner: "clicking is like an auto search").
 *
 * THE HEADER carries identity ONLY, and each fact lives in exactly one place:
 * provenance kicker (flag · court · date), the name, citation + suit, the
 * TOPIC as the subtitle (it says what the case is about — that is identity,
 * not reference), the outcome pill, actions. `origin_state` no longer floats
 * beside the outcome; it lives in About's jurisdiction row. "About this case"
 * keeps the bench (lead first), jurisdiction, tags.
 *
 * Sections carry stable ids so the wide-screen outline rail (`CaseOutline`)
 * can map and track them; `buildCaseOutline` below derives the rail's entries
 * from the SAME data checks that gate each section, so the map can never name
 * a part the page does not have.
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

/* ── Section identity — one table drives the page AND the outline rail. ──── */

const SECTION = {
  principles: 'case-principles',
  summary: 'case-summary',
  history: 'case-history',
  statutes: 'case-statutes',
  cited: 'case-cited',
  citedBy: 'case-cited-by',
  similar: 'case-similar',
  about: 'case-about',
} as const;

/** The outline rail's entries, derived from the same checks that gate each
 *  section below — `CaseScreen` renders the rail from this. */
export function buildCaseOutline(detail: CaseDetail): OutlineSection[] {
  const sections: OutlineSection[] = [];
  const hasPrinciples =
    (detail.report_principles?.length ?? 0) > 0 || !!detail.principles?.trim();
  if (hasPrinciples) sections.push({ id: SECTION.principles, label: 'Principles' });
  sections.push({ id: SECTION.summary, label: 'Summary' });
  if ((detail.court_history?.length ?? 0) > 0)
    sections.push({ id: SECTION.history, label: 'Case history' });
  if (groupStatutes(detail.statutes_cited ?? []).length > 0)
    sections.push({ id: SECTION.statutes, label: 'Statutes cited' });
  if (groupCitedCases(detail.cited_cases ?? []).length > 0)
    sections.push({ id: SECTION.cited, label: 'Cases cited' });
  if ((detail.cited_by?.length ?? 0) > 0)
    sections.push({ id: SECTION.citedBy, label: 'Cited by' });
  if ((detail.similar_cases?.length ?? 0) > 0)
    sections.push({ id: SECTION.similar, label: 'Similar cases' });
  if (hasAbout(detail)) sections.push({ id: SECTION.about, label: 'About' });
  return sections;
}

function hasAbout(detail: CaseDetail): boolean {
  return (
    normalizeBench(detail.judges).length > 0 ||
    !!detail.country ||
    (detail.tags?.length ?? 0) > 0
  );
}

/* ── The document ────────────────────────────────────────────────────────── */

export function CaseDocument({ detail }: { detail: CaseDetail }) {
  const raw = detail.display_title || detail.title;
  const name = formatCaseName(raw);
  const date = formatCaseDate(detail.judgment_date, 'long');
  const isLimited = detail.limit_exceeded === true;
  const countryCode = toAlpha2(detail.country?.code, detail.country?.abbreviation);

  const principles = [...(detail.report_principles ?? [])].sort(
    (a, b) => a.order - b.order,
  );
  const history = [...(detail.court_history ?? [])].sort((a, b) => a.order - b.order);

  const statuteItems: AuthorityItem[] = groupStatutes(detail.statutes_cited ?? []).map(
    (row) => ({
      key: row.key,
      name: row.name,
      reference: row.provisions,
      href: row.href,
      searchHref: row.searchHref,
    }),
  );

  const citedItems: AuthorityItem[] = groupCitedCases(detail.cited_cases ?? [])
    .map((row) => ({
      key: row.key,
      name: row.name,
      nameTitle: row.sourceTitle,
      reference: row.refs.join(' · ') || null,
      href: row.href,
      searchHref: row.searchHref,
      badge: meaningfulTreatment(row.treatment),
    }))
    // Rows whose treatment SAYS something (Distinguished, Overruled…) float
    // above the fold — a verdict buried at row 40 of a folded sixty-row list
    // is a verdict hidden. The sort is stable, so citation order holds within
    // each band.
    .sort((a, b) => Number(!!b.badge) - Number(!!a.badge));

  const citedByItems = (detail.cited_by ?? []).map(relatedToDisplay).map(toLibraryItem);
  const similarItems = (detail.similar_cases ?? [])
    .map(relatedToDisplay)
    .map(toLibraryItem);

  // The body is the summary; the excerpt is the honest fallback when a case has
  // not been written up yet. Neither is invented when both are absent.
  const summary = detail.body?.trim() || detail.excerpt?.trim() || '';

  return (
    <article className="flex flex-col gap-9">
      {/* ── Heading block: identity only, each fact exactly once. ────────── */}
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
          <p className="doc-citation flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {detail.citation ? <CopyCitation citation={detail.citation} /> : null}
            {detail.citation && detail.suit_no ? (
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
            ) : null}
            {detail.suit_no ? <span>Suit {detail.suit_no}</span> : null}
          </p>
        ) : null}

        {/* The topic — what the case is ABOUT, in one editorial line. */}
        {detail.topic ? (
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            {sentenceCase(detail.topic)}
          </p>
        ) : null}

        {detail.outcome ? (
          <p>
            {/* The disposition — the first question a lawyer asks, answered
                before the reading starts. Gold because it is THE answer;
                neutral in tone because which side "won" depends on your side. */}
            <span className="inline-flex min-h-6 items-center rounded-full bg-primary/10 px-2.5 text-xs font-medium text-primary">
              {outcomeLabel(detail.outcome)}
            </span>
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
        <FlatPrinciples text={detail.principles} />
      ) : null}

      {/* ── What happened. ──────────────────────────────────────────────── */}
      <section
        id={SECTION.summary}
        aria-label="Case summary"
        className="flex scroll-mt-6 flex-col gap-3"
      >
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

      <AuthorityList
        id={SECTION.statutes}
        label="Statutes cited"
        sub="Legislation this judgment applied."
        items={statuteItems}
      />
      <AuthorityList
        id={SECTION.cited}
        label="Cases cited"
        sub="Authorities this judgment relied on."
        items={citedItems}
      />
      <AuthorityList
        id={SECTION.citedBy}
        label="Cited by"
        sub="Later judgments that cite this one."
        items={citedByItems}
      />
      <AuthorityList
        id={SECTION.similar}
        label="Similar cases"
        sub="Cases on comparable facts or points of law."
        items={similarItems}
      />

      {/* ── Reference data, where reference data belongs. ───────────────── */}
      <AboutThisCase detail={detail} countryCode={countryCode} />
    </article>
  );
}

/** The badge earns its ink only when the treatment says more than "a citation
 *  happened" — `referred_to` is the enum's catch-all and marks nothing. */
function meaningfulTreatment(treatment: string | null) {
  if (!treatment || treatment === 'referred_to') return null;
  return formatTreatment(treatment);
}

/**
 * The citation line as a one-click copy — the string a lawyer retypes into
 * every brief. The confirmation lives IN the control (icon flips to a check
 * for two seconds), the same rule as the Share action's "Link copied".
 * Clipboard denial fails silent: the text is still selectable.
 */
function CopyCitation({ citation }: { citation: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(citation);
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
      aria-label={copied ? 'Citation copied' : 'Copy the citation'}
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

/** Map a library case (cited_by / similar — always linked) to the row model. */
function toLibraryItem(display: RelatedCaseDisplay): AuthorityItem {
  const reference = [
    firstCitation(display.citation),
    display.court?.name,
    formatCaseDate(display.judgmentDate, 'year'),
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    key: display.key,
    name: formatCaseName(display.title),
    nameTitle: display.title,
    reference: reference || null,
    href: display.href,
    searchHref: null,
    badge: meaningfulTreatment(display.treatment),
  };
}

/**
 * The end-of-document reference block — the bench (lead first, with coram
 * roles), jurisdiction, tags — as a quiet definition list. A reader consults
 * this; nobody should have to climb over it. The topic is NOT here: it is the
 * header's subtitle, and a fact lives in one place.
 */
function AboutThisCase({
  detail,
  countryCode,
}: {
  detail: CaseDetail;
  countryCode: string | null;
}) {
  const bench = normalizeBench(detail.judges);
  const hasTags = !!detail.tags && detail.tags.length > 0;
  if (bench.length === 0 && !detail.country && !hasTags) return null;

  return (
    <section
      id={SECTION.about}
      aria-label="About this case"
      className="flex scroll-mt-6 flex-col gap-3"
    >
      <SectionHeading label="About this case" />
      <dl className="flex flex-col gap-3">
        {bench.length > 0 ? (
          <AboutRow term={bench.length === 1 ? 'Judge' : 'Coram'}>
            {bench.map((judge, index) => (
              <span key={judge.key}>
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
 * The enrichment-era holding, as a NUMBERED LIST — because that is what this
 * data IS: the holdings list a law report prints before the judgment. Each
 * entry is the verbatim principle with a hanging gold numeral in the margin
 * and one caption line in one voice: Ratio/Obiter · the subject tag · the
 * judge who said it. The numeral replaced the section-long gold bar — the
 * bar made eight principles read as one continuous column with no boundaries
 * (owner: "disorganised… not nicely rendered").
 *
 * `reviewed: false` rows only reach Researcher+ accounts (the server filters
 * them for everyone else), and they are BADGED rather than hidden — a reviewer
 * seeing unreviewed text unmarked would republish it by trusting it.
 */
function StructuredPrinciples({ principles }: { principles: ReportPrinciple[] }) {
  return (
    <section
      id={SECTION.principles}
      aria-label="Legal principles"
      className="flex scroll-mt-6 flex-col gap-3"
    >
      <SectionHeading
        label="Legal principles"
        count={principles.length}
        sub="Verbatim from the judgment."
      />
      <ol className="flex flex-col gap-7">
        {principles.map((principle, index) => (
          <NumberedPrinciple key={principle.id} index={index}>
            <div className="doc-prose">
              <CaseText value={principle.principle} />
            </div>
            <PrincipleCaption principle={principle} />
          </NumberedPrinciple>
        ))}
      </ol>
    </section>
  );
}

/**
 * The pre-enrichment fallback: a case whose principles are ONE flat editorial
 * string. Measured on live rows the field comes in two shapes, and each gets
 * its own rendering:
 *
 *   several blank-line paragraphs  = one principle per paragraph (Mustapha v
 *                                    Abubakar ships five) → the SAME numbered
 *                                    entries as the structured list, minus the
 *                                    captions no metadata exists for;
 *   one continuous passage         = nothing to number (a lone "01" would be
 *                                    decoration) → the gold-rule block.
 *
 * So an unenriched case reads like an enriched one, and the day its
 * enrichment lands the page's shape barely moves.
 */
function FlatPrinciples({ text }: { text: string }) {
  const paragraphs = caseTextParagraphs(text);
  if (paragraphs.length === 0) return null;

  return (
    <section
      id={SECTION.principles}
      aria-label="Legal principles"
      className="flex scroll-mt-6 flex-col gap-3"
    >
      {paragraphs.length === 1 ? (
        <>
          <SectionHeading label="Legal principles" />
          <div className="doc-holding">
            <div className="doc-prose">
              <CaseText value={paragraphs[0]} />
            </div>
          </div>
        </>
      ) : (
        <>
          <SectionHeading label="Legal principles" count={paragraphs.length} />
          <ol className="flex flex-col gap-7">
            {paragraphs.map((paragraph, index) => (
              <NumberedPrinciple key={index} index={index}>
                <div className="doc-prose">
                  <CaseText value={paragraph} />
                </div>
              </NumberedPrinciple>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

/** One numbered holding — the hanging gold numeral beside the law. One
 *  component, so the structured list and the flat fallback cannot drift. */
function NumberedPrinciple({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)]">
      <span aria-hidden className="doc-principle-num">
        {String(index + 1).padStart(2, '0')}
      </span>
      {children}
    </li>
  );
}

/** The one caption line under a principle — its whole apparatus in one voice. */
function PrincipleCaption({ principle }: { principle: ReportPrinciple }) {
  const parts: React.ReactNode[] = [];

  if (principle.type) {
    parts.push(
      principle.type === 'ratio' ? (
        <span key="type" className="font-medium text-primary">
          Ratio
        </span>
      ) : (
        <span key="type" className="font-medium">
          Obiter
        </span>
      ),
    );
  }
  const lawType = lawTypeLabel(principle.law_type);
  if (lawType) {
    parts.push(<span key="law">{lawType}</span>);
  }
  if (principle.tag) {
    parts.push(<span key="tag">{sentenceCase(principle.tag)}</span>);
  }
  if (principle.judge?.name) {
    parts.push(
      <span key="judge">
        Per {formatCaseName(principle.judge.name)}
        {principle.judge.role ? ` (${ROLE_LABELS[principle.judge.role]})` : ''}
      </span>,
    );
  }

  if (parts.length === 0 && principle.reviewed) return null;

  return (
    <p className="col-start-2 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {parts.flatMap((part, index) =>
        index === 0
          ? [part]
          : [
              <span key={`dot-${index}`} aria-hidden className="text-muted-foreground/40">
                ·
              </span>,
              part,
            ],
      )}
      {!principle.reviewed ? (
        <span className="inline-flex min-h-5 items-center rounded-full bg-amber-500/15 px-2 text-[11px] font-medium text-amber-700 dark:text-amber-400">
          Unreviewed
        </span>
      ) : null}
    </p>
  );
}

/**
 * The case's journey through the courts, in order. Linked steps navigate to the
 * earlier decision; unlinked steps render their label as text — same rule as an
 * unresolved citation.
 */
function CaseHistory({ steps }: { steps: CourtHistoryStep[] }) {
  return (
    <section
      id={SECTION.history}
      aria-label="Case history"
      className="flex scroll-mt-6 flex-col gap-3"
    >
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

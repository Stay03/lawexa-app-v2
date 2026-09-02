'use client';

import { Fragment } from 'react';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ObservabilityTable, ErrorCell, StatusBadge } from '../index';
import { itemStatusMeta, matchMethodLabel } from './status';
import {
  caseMaintenanceDetail,
  type CaseMaintenanceItem,
  type CaseMaintenanceItemDetail,
  type CaseMaintenanceNameSearch,
  type CaseMaintenanceReference,
} from '@/types/admin-case-maintenance-runs';

/* FOUR COLUMNS, NOT FIVE, AND THE WIDTHS ARE DECLARED.
   Filmed at 1280 with real-length case titles, the five-column version pushed
   the actions column off the side of the table: both decision buttons were in
   the DOM — which is all an assertion for them proves — and neither could be
   seen or pressed. The long titles also ran under the status badge.
   "Matched by" was the column to lose: for a row awaiting a decision it always
   reads "Matched by title only", which is the only reason such a row exists,
   so it was spending a column to repeat the status. It moves under the title
   for the rows where it varies. */
const COLUMNS = [
  { key: 'case', label: 'Case', className: 'w-[38%]' },
  { key: 'status', label: 'Status', className: 'w-[14%]' },
  { key: 'detail', label: 'What happened', className: 'w-[30%]' },
  { key: 'act', label: <span className="sr-only">Decide</span>, className: 'w-[18%] text-right' },
];

/* ── GROUPING BY CONFIDENCE ────────────────────────────────────────────────
   Four bands, because the data means four different things and collapsing any
   two of them tells the reviewer something false.

   The two that must never merge are `nothing` and `unscored`, and the server
   enforces the same split:
     score 0    we searched, candidates came back, none resembled the case.
                Item 103 has TEN candidates, every one scoring 0.
     score null there was nothing to score — no candidate at all, or the item
                never went to a name search. 100 of 116 items are in this state.
   Showing both as "found nothing" would claim we looked at a hundred cases and
   rejected them, when we never looked. */
type ScoreBand = 'over' | 'under' | 'nothing' | 'unscored';

function scoreBand(item: CaseMaintenanceItem): ScoreBand {
  if (item.score === null || item.score === undefined) return 'unscored';
  if (item.score === 0) return 'nothing';
  /* Compared against the server's own bar rather than a number typed here, so
     the grouping cannot drift from the rule the matcher actually applies. */
  if (item.threshold !== null && item.threshold !== undefined && item.score >= item.threshold) {
    return 'over';
  }
  return 'under';
}

const BAND_LABEL: Record<ScoreBand, string> = {
  over: 'Strong match',
  under: 'Needs your judgement',
  nothing: 'Nothing resembled it',
  unscored: 'Not searched by name',
};

const BAND_MEANING: Record<ScoreBand, string> = {
  over: 'scored at or above the bar the matcher accepts on',
  under: 'scored below the bar — close enough to be worth a look',
  nothing: 'we searched, results came back, none of them were this case',
  unscored: 'no candidate to score — matched another way, or nothing to search',
};

/**
 * Every case inside a run, and the one place a person decides something.
 *
 * ── THE CONFIRM STEP, AND WHY IT IS SHAPED THIS WAY ───────────────────────
 * 126 of the NWLR cases can only be tied to a document by their title. A wrong
 * match writes ANOTHER CASE'S JUDGMENT into ours and cannot be undone — the old
 * report is replaced and only a side table holds the previous text. So those
 * items stop at `awaiting_confirmation` and nothing is written until somebody
 * chooses.
 *
 * Which means the two buttons are not equals and must not look like it:
 *
 *  - "Not this one" is the SAFE choice and is the plain one. It writes nothing.
 *  - "Yes, use it" is the one that writes, so it carries the weight, and it is
 *    the one that has to be aimed at rather than fallen onto.
 *
 * The candidate itself is printed in the row before either button, because a
 * person cannot judge a match they cannot see, and a screen that asks for a
 * decision without showing the evidence is asking for a rubber stamp.
 */
export function CaseMaintenanceItemsTable({
  items,
  isLoading,
  onDecide,
  decidingId,
}: {
  items: CaseMaintenanceItem[];
  isLoading: boolean;
  /** `null` when the run cannot be decided on — finished, cancelled, or busy. */
  onDecide: ((itemId: number, decision: 'confirm' | 'reject') => void) | null;
  /** The row currently being written, so both its buttons can go quiet. */
  decidingId: number | null;
}) {
  return (
    <ObservabilityTable
      columns={COLUMNS}
      isLoading={isLoading}
      isEmpty={items.length === 0}
      emptyText="No cases in this run yet"
    >
      {items.map((item, index) => {
        const awaiting = item.status === 'awaiting_confirmation';
        const busy = decidingId === item.id;
        /* A heading whenever the band changes. The rows arrive already ordered
           by the server, so this only has to notice the boundary — it never
           reorders anything itself, which would produce a page that looks
           grouped and disagrees with page two. */
        const band = scoreBand(item);
        const newBand = index === 0 || scoreBand(items[index - 1]) !== band;
        return (
          <Fragment key={item.id}>
          {newBand && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={COLUMNS.length} className="bg-muted/40 py-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold">{BAND_LABEL[band]}</span>
                  <span className="text-xs text-muted-foreground">
                    {BAND_MEANING[band]}
                  </span>
                </div>
              </TableCell>
            </TableRow>
          )}
          <TableRow>
            {/* `max-w-0` with a declared column width is what actually makes a
                table cell truncate: without it the cell grows to its content and
                pushes everything after it out of view. */}
            <TableCell className="max-w-0">
              {/* A CASE WITH NO TITLE MUST STILL BE A ROW YOU CAN SEE.
                  `title` is typed as a plain string, so an empty one rendered as
                  a link with nothing in it: a blank line the reviewer cannot
                  read, cannot click with any confidence, and cannot tell apart
                  from the next blank one. That is the worst possible row on a
                  screen whose whole job is telling near-identical cases apart.

                  `??` does not help here — the empty string is not null, it is
                  present and empty, which is the case that actually arrives. */}
              <Link
                href={`/cases/${item.case.slug}`}
                target="_blank"
                rel="noreferrer"
                title={item.case.title?.trim() || 'This case has no title'}
                className="block truncate font-medium underline-offset-4 hover:underline"
              >
                {item.case.title?.trim() || (
                  <span className="italic text-muted-foreground">
                    Untitled case #{item.case.id}
                  </span>
                )}
              </Link>
              <div className="truncate text-xs text-muted-foreground">
                {[item.case.citation, item.match_method ? matchMethodLabel(item.match_method) : null]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </div>
            </TableCell>

            <TableCell>
              <StatusBadge meta={itemStatusMeta(item.status)} />
            </TableCell>

            <TableCell className="max-w-0 text-sm">
              {/* The error and the evidence are drawn TOGETHER, not as
                  alternatives — see `ItemDetail`. */}
              <ItemDetail
                detail={caseMaintenanceDetail(item.detail)}
                error={item.error}
                statusCode={item.status_code}
              />
            </TableCell>

            <TableCell>
              {awaiting && onDecide ? (
                <div className="flex items-center justify-end gap-2">
                  {/* NOTHING WAS FOUND, SO THERE IS NOTHING TO ACCEPT.
                      A name search that matched no document parks the item all
                      the same — somebody still has to clear it — but there is
                      no candidate behind it. Offering "Yes, use it" here asks a
                      reviewer to accept a thing that does not exist: the server
                      refuses with "the item has no stored candidate", the row
                      does not move, and the screen looks broken. The owner hit
                      exactly this and asked, reasonably, "use what?". */}
                  {/* Safe first, and plain. Refusing writes nothing. */}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => onDecide(item.id, 'reject')}
                  >
                    {/* ALWAYS "Not this one", never a second name for the same
                        button. "Clear it" read better on a row with no
                        candidate, but backend had already told the owner four
                        times to click "Not this one" and named the rows. A
                        reader hunting a label that is not on screen is a worse
                        problem than a slightly loose word, and the line beside
                        it already says nothing was found. */}
                    Not this one
                  </Button>
                  {/* The one that writes a judgment into a case. Only offered
                      when there IS a judgment to write. */}
                  {item.provider_case_id !== null ? (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => onDecide(item.id, 'confirm')}
                    >
                      {busy ? (
                        <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Yes, use it
                    </Button>
                  ) : null}
                  {/* A TIE IS NOT A REFUSAL. Two candidates that both clear the
                      bar leave the item with no stored candidate, because a
                      machine should not choose between two equally good matches.
                      For a while that meant the ONLY thing a person could do
                      with a match that had qualified was discard it — and one
                      was discarded that way before anyone noticed. The server
                      takes a chosen candidate in preference to a stored one, so
                      the choice belongs here. */}
                  {item.provider_case_id === null ? (
                    <TieChoice item={item} busy={busy} onDecide={onDecide} />
                  ) : null}
                </div>
              ) : null}
            </TableCell>
          </TableRow>
          </Fragment>
        );
      })}
    </ObservabilityTable>
  );
}

/**
 * What the server found, in words a person can judge.
 *
 * ── IT IS AN OBJECT, AND RENDERING IT DIRECTLY WHITE-SCREENED THE PAGE ────
 * `detail` was documented as free text and is not: it carries `changed`, an
 * `evidence` record, a `reference`, `case_slug` and `boundary_confidence`.
 * Printed straight into the row, React threw error #31 and the owner lost the
 * whole run page mid-run. So nothing here renders an unknown value directly.
 *
 * ── THE ERROR AND THE EVIDENCE ARE NOT ALTERNATIVES ───────────────────────
 * This cell used to show one OR the other, and a refused row is exactly the
 * row that has both. Every conflict in the owner's runs reads "the fetched
 * document does not agree" while its own evidence says the citation matched
 * and the keys are identical — the disagreement is `v` against `v.` and a year
 * taken from the wrong line. Showing only the sentence hides the one thing
 * that would tell him the refusal is wrong.
 *
 * ── AND WHEN THERE IS NO EVIDENCE, THERE IS STILL A REASON ────────────────
 * A case that never reached the provider carries a `reference` instead: what
 * we read out of our own citation. "The citation names NWLR but carries no
 * part or page" and "we asked for Part 60, page 196 and got a 404" are
 * different problems with different owners, and the error sentence alone does
 * not separate them.
 */
function ItemDetail({
  detail,
  error,
  statusCode,
}: {
  detail: CaseMaintenanceItemDetail | null;
  error: string | null;
  statusCode: number | null;
}) {
  /* EVIDENCE THAT SAYS NOTHING IS NOT EVIDENCE. `Comparison` builds its line
     from three booleans, and a name-search item carries none of them — so an
     evidence object can be present, truthy, and render an entirely empty cell.
     Measured on screen: a Done row with nothing at all under What happened,
     while every citation-matched row beside it showed two lines. Treat it as
     absent so the fallback below speaks instead. */
  const rawEvidence = detail?.evidence;
  const evidence =
    rawEvidence &&
    (rawEvidence.citation_match !== undefined ||
      rawEvidence.year_match !== undefined ||
      rawEvidence.title_match !== undefined ||
      Boolean(rawEvidence.document_title))
      ? rawEvidence
      : undefined;
  const reference = detail?.reference;
  const search = detail?.name_search;

  /* A NAME SEARCH IS THE WHOLE STORY ON A ROW THAT NEEDS A DECISION, and it
     was being thrown away. Rendered before the generic fallbacks so the rows
     asking most of a reviewer stop being the only rows that tell them
     nothing. */
  if (search) {
    return (
      <div className="space-y-0.5">
        {error ? <ErrorCell error={error} wrap /> : null}
        <NameSearchDetail search={search} />
      </div>
    );
  }

  /* THE ORDER OF THE NEXT TWO BRANCHES IS LOAD-BEARING. DO NOT SWAP THEM.
     A gateway miss on the ordinary citation path closes the item with `detail`
     set to an EMPTY ARRAY rather than null, and PHP serialises an empty
     associative array as JSON `[]`, which is TRUTHY here. Measured on the live
     queue: eight rows carry `detail: []`, every one a 404 with a real `error`
     ("NWLR has no document at the derived key: no case found for key
     '60_1_196'").
     Because the error is tested first, those rows render their real reason.
     Test the detail first and they fall through to `detail.changed`, which is
     undefined, and the screen prints "Nothing changed" about a case the
     provider could not find — a false statement about case law, produced
     silently. Hence the emptiness check below rather than a bare `!detail`. */
  if (!error && !evidence) {
    const emptyDetail =
      !detail || (typeof detail === 'object' && Object.keys(detail).length === 0);
    if (emptyDetail) return <span className="text-muted-foreground">—</span>;
    return (
      <span className="text-muted-foreground">
        {detail.changed ? 'Replaced from NWLR' : 'Nothing changed'}
      </span>
    );
  }

  return (
    <div className="space-y-0.5">
      {error ? <ErrorCell error={error} wrap /> : null}
      {/* The status code is sent on every failure precisely so a person can
          tell a provider outage from a case we simply could not find. */}
      {statusCode !== null ? (
        <span className="block text-xs text-muted-foreground">HTTP {statusCode}</span>
      ) : null}
      {evidence ? <Comparison evidence={evidence} /> : null}
      {!evidence && reference ? <ReferenceLine reference={reference} /> : null}
    </div>
  );
}

/**
 * Break a tie by picking one of the candidates that qualified.
 *
 * Only rendered where the search produced no winner but did produce candidates
 * ABOVE the threshold — the case the backend refuses to decide on its own.
 * Candidates below the bar are not offered: nothing there is worth writing into
 * a case, and listing them would invite exactly the mistaken confirmation the
 * threshold exists to prevent.
 */
function TieChoice({
  item,
  busy,
  onDecide,
}: {
  item: CaseMaintenanceItem;
  busy: boolean;
  onDecide: (itemId: number, decision: 'confirm' | 'reject', providerCaseId?: string | null) => void;
}) {
  const search = caseMaintenanceDetail(item.detail)?.name_search;
  const threshold = search?.threshold ?? null;
  const qualified = (search?.candidates ?? []).filter(
    (candidate) =>
      candidate.provider_case_id !== null &&
      candidate.title_similarity !== null &&
      candidate.title_similarity !== undefined &&
      threshold !== null &&
      candidate.title_similarity >= threshold,
  );
  if (qualified.length === 0) return null;

  const reasons = (search?.reasons ?? []).filter(
    (reason): reason is string => typeof reason === 'string' && reason.length > 0,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" disabled={busy}>
          {busy ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : null}
          Choose one
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-[420px]">
        {/* THE REASON IS NOT ALWAYS A TIE, AND SAYING IT IS MISLEADS THE ONE
            PERSON WHO CAN STILL CATCH IT. This said "Both matched equally" on
            every row. Measured against the live queue, the ONLY row offering a
            choice was not a tie at all: one candidate at 100, withheld because
            a Part signal on it contradicted the Part we parsed and no year
            agreed. Every true tie there scored below the bar and correctly
            offered nothing. So the old copy reassured a reviewer on precisely
            the row the backend had flagged as suspicious. The label now
            follows the count, and the server's own reasons are shown, because
            a reviewer overriding a refusal has to see what they are
            overriding. */}
        {/* NEITHER LABEL MAY ASSERT WHY. The plural one used to read "These
            matched equally", which repeats the same fault in miniature: two
            candidates scoring 100 and 72 both clear a bar of 70 and did NOT
            match equally. The server treats a tie as a MARGIN — its own reason
            reads "within 5 points of each other" — so clearing the bar and
            tying are different things, and only the server knows which
            happened. Both labels now describe what is on the screen and leave
            the reason to the reasons. */}
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {qualified.length > 1
            ? 'More than one case cleared the bar. Pick the right one.'
            : 'This was not used automatically. Read why before you use it.'}
        </DropdownMenuLabel>
        {reasons.length > 0 ? (
          <p className="px-2 pb-1.5 text-[11px] leading-snug text-amber-600 dark:text-amber-500">
            {/* The server sends each reason lowercase and unterminated, so
                joining them raw reads "...use it. a Part signal ... . no year
                the case carries ...". Capitalise for the sentence they are
                rendered as; the wording itself stays the server's. */}
            {reasons.map((reason) => reason.charAt(0).toUpperCase() + reason.slice(1)).join('. ')}
          </p>
        ) : null}
        {qualified.slice(0, 5).map((candidate) => (
          <DropdownMenuItem
            key={candidate.provider_case_id}
            className="flex flex-col items-start gap-0.5 py-2"
            onSelect={() => onDecide(item.id, 'confirm', candidate.provider_case_id)}
          >
            {/* `??` misses the empty string, which is the form that actually
                arrives. A candidate you are being asked to pick must never
                render as nothing. */}
            <span className="text-xs font-medium">
              {candidate.title?.trim() || 'Untitled'}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {candidate.citation ?? 'no citation'} · match {candidate.title_similarity}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * What the name search proposes, and how sure it is.
 *
 * The row's whole job is to let somebody rule on a match. That is impossible
 * without seeing the match, which is what "use what?" meant. So: the case
 * being proposed and its score when there is one, and when there is not, the
 * reason plus the best thing found — because "we searched and the closest was
 * this, scoring nothing" is a real answer and an empty cell is not.
 */
function NameSearchDetail({ search }: { search: CaseMaintenanceNameSearch }) {
  const winner = search.winner ?? null;
  const best = winner ?? search.candidates?.[0] ?? null;
  const reason = search.reasons?.[0] ?? null;
  /* A tie is the case that cleared the bar and still needs a person. Read from
     the score against the threshold rather than by matching words in `reasons`,
     which is prose and free to change. */
  const tied =
    !winner &&
    best?.title_similarity !== null &&
    best?.title_similarity !== undefined &&
    search.threshold !== null &&
    search.threshold !== undefined &&
    best.title_similarity >= search.threshold;

  return (
    <div className="space-y-1">
      {winner ? (
        <>
          <span className="block text-xs font-medium text-foreground">
            Proposes: {winner.title?.trim() || 'an untitled case'}
          </span>
          {winner.citation ? (
            <span className="block text-xs text-muted-foreground">{winner.citation}</span>
          ) : null}
        </>
      ) : (
        /* WHY there is no winner, not just that there is none. Two candidates
           scoring 75 against a threshold of 70 is not "nothing close enough" —
           it is two cases equally close, which is the situation where a person
           genuinely has to choose. Saying the wrong one contradicts the score
           printed directly beneath it. */
        <span className="block text-xs font-medium text-amber-700 dark:text-amber-400">
          {tied ? 'More than one case matches equally' : 'Nothing close enough to use'}
        </span>
      )}

      {/* The number the decision turns on, next to the line it had to clear. */}
      {best?.title_similarity !== null && best?.title_similarity !== undefined ? (
        <span className="block text-xs text-muted-foreground">
          Name match {best.title_similarity}
          {search.threshold !== null && search.threshold !== undefined
            ? ` of ${search.threshold} needed`
            : null}
          {best.shares_party === false ? ' · no party in common' : null}
          {best.shares_party === true ? ' · shares a party' : null}
        </span>
      ) : null}

      {/* Not the winner, so name it — otherwise the score above reads as if it
          belonged to a case being proposed. */}
      {!winner && best?.title ? (
        <span className="block text-xs text-muted-foreground">
          Closest was {best.title}
        </span>
      ) : null}

      {reason ? (
        <span className="block text-xs text-muted-foreground">{reason}</span>
      ) : null}
    </div>
  );
}

/**
 * Which parts of our record and the fetched document agreed.
 *
 * That is the only question that matters on a conflict. A case whose citation
 * matched but whose titles did not is precisely the one a person should rule
 * on — "Abacha v Fawehinmi" against "Abacha v. Fawehinmi" is the same case; a
 * different name entirely is not. So the three comparisons are named plainly,
 * and the two titles are put side by side underneath, because that is the
 * comparison being made.
 */
function Comparison({ evidence }: { evidence: NonNullable<CaseMaintenanceItemDetail['evidence']> }) {
  const agreed: string[] = [];
  const differed: string[] = [];
  const note = (label: string, ok: boolean | undefined) => {
    if (ok === true) agreed.push(label);
    else if (ok === false) differed.push(label);
  };
  note('citation', evidence.citation_match);
  note('year', evidence.year_match);
  note('title', evidence.title_match);

  return (
    <>
      <div className="truncate">
        {agreed.length > 0 ? (
          <span className="text-emerald-700 dark:text-emerald-400">
            {agreed.join(' and ')} agree
          </span>
        ) : null}
        {agreed.length > 0 && differed.length > 0 ? ', ' : null}
        {differed.length > 0 ? (
          <span className="text-amber-700 dark:text-amber-400">
            {differed.join(' and ')} differ
          </span>
        ) : null}
      </div>
      {/* The two titles, which is the comparison a person is actually making. */}
      {evidence.document_title ? (
        <div
          className="truncate text-xs text-muted-foreground"
          title={`Ours: ${evidence.our_title ?? '—'} | Theirs: ${evidence.document_title}`}
        >
          Theirs: {evidence.document_title}
        </div>
      ) : null}
    </>
  );
}

/** What we read out of our own citation, for a case that never got matched. */
function ReferenceLine({ reference }: { reference: CaseMaintenanceReference }) {
  if (typeof reference.part === 'number') {
    return (
      <span className="block text-xs text-muted-foreground">
        Asked for Part {reference.part}
        {typeof reference.page === 'number' ? `, page ${reference.page}` : ', no page'}
      </span>
    );
  }
  return (
    <span className="block text-xs text-muted-foreground">
      {reference.mentions_nwlr
        ? 'The citation names NWLR but carries no part or page'
        : 'No NWLR citation to look up'}
    </span>
  );
}

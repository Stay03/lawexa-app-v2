import Link from 'next/link';
import { MessagesSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { casePartyName } from '@/lib/utils/party-name';
import type { CaseArgument, CaseArgumentAuthority, CaseArgumentStatus } from '@/types/case';

interface CaseArgumentsSectionProps {
  arguments: CaseArgument[];
  className?: string;
  animationDelay?: number;
}

/**
 * What each side argued, and what the court said back.
 *
 * ── ONLY REVIEWED ROWS REACH A READER ─────────────────────────────────────
 * The server already withholds unreviewed rows from anyone below Researcher,
 * at load time. This filters again rather than trusting that, because the
 * roles that DO receive unreviewed rows are reading the same public page as
 * everybody else, and an unvetted summary of a party's case is the last thing
 * that should appear under a judgment. A row with no `reviewed` field counts
 * as not reviewed: the safe direction is to show less.
 *
 * ── NULL IS THE NORMAL CASE FOR HALF OF THESE FIELDS ──────────────────────
 * A judgment that writes "learned counsel submitted" names no side, and the
 * verbatim quote and window are null on every row today because nothing
 * writes them yet. Each part renders only when it is there, and a row that is
 * nothing but an argument still reads as an argument.
 */
function CaseArgumentsSection({
  arguments: rows,
  className,
  animationDelay = 0,
}: CaseArgumentsSectionProps) {
  const groups = groupBySide(rows);
  if (groups.length === 0) return null;

  return (
    <div
      className={cn(
        'rounded-lg bg-muted/30 p-4',
        'animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both motion-reduce:animate-none',
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <MessagesSquare className="h-3.5 w-3.5" />
        <span>Arguments</span>
      </div>

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.key}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{group.label}</p>
            <ul className="mt-1.5 space-y-3">
              {group.rows.map((row) => (
                <li key={row.id} className="border-l-2 border-border pl-3">
                  <p className="text-sm leading-snug">{row.argument}</p>

                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    {row.counsel_name && <span>{casePartyName(row.counsel_name)}</span>}
                    {statusLabel(row.status) && (
                      <span className={cn('rounded px-1.5 py-0.5', statusTone(row.status))}>
                        {statusLabel(row.status)}
                      </span>
                    )}
                  </p>

                  {row.court_response && (
                    <div className="mt-1.5 rounded bg-background/60 p-2">
                      <p className="text-sm leading-snug">{row.court_response}</p>
                      {/* `judge` is ABSENT when no judge is attached to this
                          row, which says nothing about the case's panel. */}
                      {row.judge?.name && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {row.judge.name}
                          {row.judge.role ? `, ${row.judge.role}` : ''}
                        </p>
                      )}
                    </div>
                  )}

                  {row.verbatim_quote && (
                    <blockquote className="mt-1.5 border-l-2 border-muted-foreground/30 pl-2 text-xs italic text-muted-foreground">
                      {row.verbatim_quote}
                    </blockquote>
                  )}

                  {row.authorities && row.authorities.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-xs">
                      <span className="text-muted-foreground">On</span>
                      {row.authorities.map((authority, i) => (
                        <Authority key={authorityKey(authority, i)} authority={authority} />
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * An authority the submission stands on.
 *
 * `cited_case_id` and `slug` stay null until the reporter key resolves to a
 * case we hold, so an unresolved authority prints its name or its key and
 * never becomes a link to nowhere.
 */
function Authority({ authority }: { authority: CaseArgumentAuthority }) {
  const label = authority.display_title ?? authority.nwlr_key ?? null;
  if (!label) return null;
  if (authority.slug) {
    return (
      <Link href={`/cases/${authority.slug}`} className="text-primary hover:underline">
        {label}
      </Link>
    );
  }
  return <span>{label}</span>;
}

function authorityKey(authority: CaseArgumentAuthority, index: number): string {
  return `${authority.cited_case_id ?? authority.nwlr_key ?? authority.display_title ?? 'row'}-${index}`;
}

const STATUS_LABELS: Record<Exclude<CaseArgumentStatus, null>, string> = {
  accepted: 'accepted',
  rejected: 'rejected',
  partly_accepted: 'partly accepted',
  not_decided: 'not decided',
};

function statusLabel(status: CaseArgumentStatus | undefined): string | null {
  if (!status) return null;
  return STATUS_LABELS[status] ?? status;
}

function statusTone(status: CaseArgumentStatus | undefined): string {
  if (status === 'accepted') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  if (status === 'rejected') return 'bg-destructive/10 text-destructive';
  if (status === 'partly_accepted') return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
  return 'bg-muted';
}

interface ArgumentGroup {
  key: string;
  label: string;
  rows: CaseArgument[];
}

/** The sides a judgment names, then the rows where it named none. */
const SIDE_ORDER = ['appellant', 'respondent', 'applicant'] as const;

function sideLabel(side: string): string {
  const word = side.charAt(0).toUpperCase() + side.slice(1).toLowerCase();
  return `For the ${word}`;
}

function groupBySide(rows: CaseArgument[]): ArgumentGroup[] {
  // Unreviewed rows never render; see the note above the component.
  const reviewed = rows.filter((row) => row?.reviewed === true && !!row.argument);
  if (reviewed.length === 0) return [];

  const groups: ArgumentGroup[] = [];
  const seen = new Set<string>();

  const push = (key: string, label: string, of: (row: CaseArgument) => boolean) => {
    const rowsOfSide = reviewed.filter(of);
    if (rowsOfSide.length) {
      groups.push({ key, label, rows: rowsOfSide });
      rowsOfSide.forEach((row) => seen.add(String(row.id)));
    }
  };

  for (const side of SIDE_ORDER) push(side, sideLabel(side), (row) => row.side === side);

  // A side we have never seen keeps its own name; a row with no side says so,
  // because "For the Appellant" over an unattributed submission is a claim the
  // judgment did not make.
  const others = reviewed.filter((row) => !seen.has(String(row.id)));
  const named = others.filter((row) => !!row.side);
  const unnamed = others.filter((row) => !row.side);

  const byName = new Map<string, CaseArgument[]>();
  for (const row of named) {
    const side = row.side as string;
    const list = byName.get(side);
    if (list) list.push(row);
    else byName.set(side, [row]);
  }
  for (const [side, list] of byName) groups.push({ key: side, label: sideLabel(side), rows: list });

  if (unnamed.length) groups.push({ key: 'unnamed', label: 'Side not stated', rows: unnamed });

  return groups;
}

export { CaseArgumentsSection };

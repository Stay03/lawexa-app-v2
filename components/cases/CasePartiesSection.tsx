import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { casePartyName } from '@/lib/utils/party-name';
import type { CaseParty, PartiesNumbered } from '@/types/case';

interface CasePartiesSectionProps {
  parties: CaseParty[];
  /** Which side the cover numbered. Absent means the cover numbered neither. */
  numbered?: PartiesNumbered | null;
  className?: string;
  animationDelay?: number;
}

/**
 * Everyone the report's cover names, by side.
 *
 * ── THE TITLE IS NOT THE PARTY LIST ───────────────────────────────────────
 * The heading says "Refuge Home Savings & Loans Ltd. v Garkuwa" and the cover
 * names thirteen people. A reader looking for whether their client is in a
 * case cannot find that in a two-name title, and until now the page had no
 * other place to look.
 *
 * ── THE NUMBERING BELONGS TO A SIDE, NOT TO A ROW ─────────────────────────
 * A cover numbers the side it needs to number: "1st - 10th Respondents"
 * against a single unnumbered appellant. `parties_numbered` says which side
 * carried numbers, so this prints them for that side only. Numbering a side
 * the report left bare invents an ordinal the judgment never used, and
 * counsel lines refer to parties by exactly those ordinals.
 *
 * ── A SIDE CAN HOLD TWO LISTS, AND THE NUMBERING RESTARTS IN EACH ─────────
 * A cover joining two lists with AND (two shareholders AND two banks, each
 * numbered 1 and 2) sends them as one side with different `group` values. Run
 * together they would read as four parties numbered 1, 2, 1, 2. Each group is
 * therefore its own numbered list, in group order, with no heading of its own,
 * because the cover gave the groups no names.
 */
function CasePartiesSection({
  parties,
  numbered,
  className,
  animationDelay = 0,
}: CasePartiesSectionProps) {
  const sides = groupBySide(parties);
  if (sides.length === 0) return null;

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
        <Users className="h-3.5 w-3.5" />
        <span>Parties</span>
      </div>

      <div className="space-y-3">
        {sides.map((side) => {
          const showOrdinals = isNumbered(side.role, numbered) && side.rows.length > 1;
          return (
            <div key={side.role}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {sideLabel(side.role, side.rows.length)}
              </p>
              {side.groups.map((group) => (
                <ol key={group.key} className="mt-1 space-y-0.5">
                  {group.rows.map((party) => (
                    <li key={`${party.position}-${party.name}`} className="text-sm leading-snug">
                      {/* The ordinal is the cover's own `position`, never the
                          row's place in this list. A counsel line reads "for
                          the 1st - 10th Respondents" and means the cover's
                          numbers, so renumbering a list that starts at 2, or
                          that has a row we dropped, would point the reader at
                          the wrong party while looking perfectly ordinary. */}
                      {showOrdinals && (
                        <span className="mr-1.5 tabular-nums text-muted-foreground">
                          {ordinal(party.position)}
                        </span>
                      )}
                      <span className="font-medium">{casePartyName(party.name)}</span>
                      {party.appeal_number && (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {party.appeal_number}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PartyGroup {
  key: string;
  rows: CaseParty[];
}

interface PartySide {
  role: string;
  rows: CaseParty[];
  /** The side's lists in group order; one group on almost every cover. */
  groups: PartyGroup[];
}

/**
 * The sides in the order the cover printed them, each side's rows in the
 * cover's order. `position` is the cover's own numbering, so it drives the
 * order rather than the array's.
 */
function groupBySide(parties: CaseParty[]): PartySide[] {
  const order: string[] = [];
  const byRole = new Map<string, CaseParty[]>();

  for (const party of parties) {
    if (!party?.name) continue;
    const role = party.role || 'party';
    let rows = byRole.get(role);
    if (!rows) {
      rows = [];
      byRole.set(role, rows);
      order.push(role);
    }
    rows.push(party);
  }

  return order.map((role) => {
    const rows = [...byRole.get(role)!].sort(
      (a, b) => (a.group ?? 1) - (b.group ?? 1) || a.position - b.position
    );
    return { role, rows, groups: splitByGroup(rows) };
  });
}

/** The rows of one side split into its lists, in group order. */
function splitByGroup(rows: CaseParty[]): PartyGroup[] {
  const order: number[] = [];
  const byGroup = new Map<number, CaseParty[]>();

  for (const row of rows) {
    // A row with no group belongs to the cover's single list, which is group 1.
    const group = row.group ?? 1;
    let list = byGroup.get(group);
    if (!list) {
      list = [];
      byGroup.set(group, list);
      order.push(group);
    }
    list.push(row);
  }

  return order.map((g) => ({ key: String(g), rows: byGroup.get(g)! }));
}

/** Only the two sides the flag names can be numbered; anything else cannot. */
function isNumbered(role: string, numbered: PartiesNumbered | null | undefined): boolean {
  if (!numbered) return false;
  if (role === 'appellant') return numbered.appellant;
  if (role === 'respondent') return numbered.respondent;
  return false;
}

/**
 * "Appellants", "Respondents", and "Parties" rather than "Partys" for a row
 * whose role the cover did not name.
 */
function sideLabel(role: string, count: number): string {
  const word = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  if (count === 1) return word;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(?:s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}

/** 1st, 2nd, 3rd, 11th: the ordinals a Nigerian cover prints. */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const rem10 = n % 10;
  if (rem10 === 1) return `${n}st`;
  if (rem10 === 2) return `${n}nd`;
  if (rem10 === 3) return `${n}rd`;
  return `${n}th`;
}

export { CasePartiesSection };

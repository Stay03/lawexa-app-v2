import { Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { casePartyName } from '@/lib/utils/party-name';
import type { CaseCounselLine, CaseCounselPerson } from '@/types/case';

interface CaseCounselSectionProps {
  counsel: CaseCounselLine[];
  className?: string;
  animationDelay?: number;
}

/**
 * The lawyers who appeared, one entry per line the report printed.
 *
 * ── THE PRINTED LINE IS THE RECORD AND IT IS SHOWN WHOLE ──────────────────
 * A counsel line carries more than names: who led, who was with them, which
 * numbered parties they appeared for, and sometimes an office. The split into
 * people is ours and can be wrong; the line is the report's and cannot. So the
 * line is printed exactly as it arrives and the people sit underneath it, and
 * a reader who doubts the split can read the line.
 *
 * ── AN UNSURE ROW SAYS SO ─────────────────────────────────────────────────
 * A line the splitter could not read cleanly (an unclosed bracket, an office
 * that looks like a second person) is marked rather than hidden or silently
 * shown as fact.
 */
function CaseCounselSection({
  counsel,
  className,
  animationDelay = 0,
}: CaseCounselSectionProps) {
  const lines = counsel.filter((c) => c && (c.line || c.names));
  if (lines.length === 0) return null;

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
        <Briefcase className="h-3.5 w-3.5" />
        <span>Counsel</span>
      </div>

      <ul className="space-y-3">
        {lines.map((line, i) => {
          const people = (line.people ?? []).filter((p) => p?.name);
          // A line naming one lawyer and nobody else has already said everything
          // the person row would say, and printing it twice reads as a fault in
          // the page rather than as a line with one name in it.
          const adds = !(people.length === 1 && sameName(people[0].name, line.names ?? line.line));
          return (
            <li key={`${i}-${line.line ?? line.names}`}>
              <p className="text-sm leading-snug">{line.line ?? line.names}</p>

              {people.length > 0 && adds && (
                <ul className="mt-1 space-y-0.5 border-l-2 border-border pl-3">
                  {people.map((person) => (
                    <li
                      key={person.name}
                      className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">
                        {casePartyName(person.name)}
                      </span>
                      {rankLabel(person) && (
                        <span className="text-xs">{rankLabel(person)}</span>
                      )}
                      {person.unsure && (
                        <span
                          className="rounded bg-muted px-1.5 py-0.5 text-xs"
                          title="The printed line did not split cleanly, so this name may be wrong. The line above is exact."
                        >
                          unsure
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Two printed names are the same name give or take spacing and a full stop. */
function sameName(a: string, b: string | null): boolean {
  if (!b) return false;
  const flat = (v: string) => v.replace(/\s+/g, ' ').replace(/[.,]+$/, '').trim().toLowerCase();
  return flat(a) === flat(b);
}

/** "with him" is already in the printed line, so the tag is the short form. */
function rankLabel(person: CaseCounselPerson): string | null {
  if (person.rank === 'lead') return 'lead';
  if (person.rank === 'with') return 'with';
  return null;
}

export { CaseCounselSection };

import Link from 'next/link';
import { GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CourtHistoryStep } from '@/types/case';

interface CaseHistorySectionProps {
  steps: CourtHistoryStep[];
  className?: string;
  animationDelay?: number;
}

/**
 * The courts this case passed through, in the report's order.
 *
 * ── LIKE THE STATUTES, THESE ROWS HAVE NEVER BEEN RENDERED ────────────────
 * `court_history` is on every case payload; Garkuwa carries three steps
 * today. Nothing read the field.
 *
 * ── A STEP MAY BE NOTHING BUT A LABEL, AND THAT IS NOT A DEFECT ───────────
 * Steps written before the provider's front matter arrived carry `label`
 * alone. Steps written after carry a court, a division, numbers, a date and
 * sometimes a panel — and carry them EMPTY where the report printed nothing,
 * which is most Court of Appeal panels. So every field here renders only when
 * present, and a step with only a label still reads as a step.
 */
function CaseHistorySection({
  steps,
  className,
  animationDelay = 0,
}: CaseHistorySectionProps) {
  const ordered = [...steps]
    .filter((s) => s && (s.label || s.court || s.court_name || s.title))
    .sort((a, b) => a.order - b.order);
  if (ordered.length === 0) return null;

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
        <GitBranch className="h-3.5 w-3.5" />
        <span>How the case got here</span>
      </div>
      <ol className="space-y-3">
        {ordered.map((step) => {
          const heading = step.court_name ?? step.court ?? step.title ?? step.label;
          // `decided_date` is the parsed day. `date_raw` is what the report
          // printed, which is sometimes a term or a year that will not parse,
          // and which arrives as SEVERAL lines: rendered as the array it is, a
          // step reads "Michaelmas Term, 1962Delivered 3rd May" in one run.
          const when = formatStepDate(step.decided_date) ?? joinLines(step.date_raw);
          const hasFacts = !!(step.division || step.numbers?.length || when);
          return (
            <li key={step.id} className="border-l-2 border-border pl-3">
              <p className="text-sm font-medium">
                {step.related_case_id !== null && step.slug ? (
                  <Link href={`/cases/${step.slug}`} className="text-primary hover:underline">
                    {heading}
                  </Link>
                ) : (
                  heading
                )}
              </p>

              {/* The label is the whole of an older step and a useful summary of a
                  newer one, so it stays underneath. Every step on the payloads
                  today is label-only, which makes the label the heading as well,
                  and a step that printed its own label twice looked broken. */}
              {step.label && step.label !== heading && (
                <p className="mt-0.5 text-sm text-muted-foreground">{step.label}</p>
              )}

              {hasFacts && (
                <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {step.division && <span>{step.division}</span>}
                  {step.numbers?.map((n) => (
                    <span key={n} className="font-mono">
                      {n}
                    </span>
                  ))}
                  {when && <span>{when}</span>}
                </p>
              )}

              {step.coram && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {step.coram}
                  {/* Where the panel was read from matters: taken from the cover,
                      it is the deciding court's panel, not this step's. */}
                  {step.coram_source ? ` (from the ${step.coram_source})` : ''}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Several printed lines as one readable line, or null when there are none. */
function joinLines(lines: string[] | null | undefined): string | null {
  if (!lines?.length) return null;
  const kept = lines.map((l) => l?.trim()).filter((l): l is string => !!l);
  return kept.length ? kept.join(' · ') : null;
}

/**
 * The same short form the case cards and the metadata grid use, or null when
 * the value will not parse, so the printed date can take over instead.
 */
function formatStepDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export { CaseHistorySection };

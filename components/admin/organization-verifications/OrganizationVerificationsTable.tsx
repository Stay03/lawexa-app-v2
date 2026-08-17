'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, FileText, FileWarning } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Organization } from '@/types/collab';

/**
 * The companies waiting to be verified, oldest wait first.
 *
 * ── WHAT IS ON A ROW, AND WHY THOSE THINGS ─────────────────────────────────
 * @arthur has to decide whether a company is who it says it is. The row carries
 * exactly what lets him skip an obvious one without opening it: the name, what
 * kind of organization it claims to be, the registration number it gave, how
 * long it has been waiting, and whether a document actually arrived.
 *
 * The number column says BN OR RC. His correction, 17 August 2026, and it was
 * not cosmetic: the only real applicant we have gave "RC 1716380" into a field
 * our own form called Business Number.
 *
 * ── THE DOCUMENT COLUMN TELLS THE TRUTH, INCLUDING WHEN IT IS BAD ──────────
 * On 17 August 2026 @backendclaude found that every verification document ever
 * uploaded had been written to a folder that our deploys delete. The database
 * row survives, so a company still looks like it sent something. It did; the
 * file is gone.
 *
 * So this column reports what is KNOWN rather than what is hoped: a document
 * whose record exists is named and sized, and nothing here promises it opens.
 * Opening is the review screen's job and it is deliberately not built until the
 * storage fix lands — a button that 404s would teach @arthur to distrust the
 * screen, which is worse than not offering it yet.
 */
export function OrganizationVerificationsTable({
  items,
  isLoading,
}: {
  items: Organization[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Building2 className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Nobody is waiting</p>
        <p className="text-sm text-muted-foreground">
          Companies appear here as soon as they apply for verification.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>BN or RC number</TableHead>
            <TableHead>Applied</TableHead>
            <TableHead>Document</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((org) => (
            <TableRow key={org.uuid}>
              <TableCell>
                {/* The NAME is the way in, not a separate "view" column: the
                    thing a reader wants to open is the company, so that is what
                    they click. */}
                <Link
                  href={`/admin/organization-verifications/${org.uuid}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {org.name}
                </Link>
                <div className="text-sm text-muted-foreground">
                  {org.type_label}
                  {org.active_members_count != null
                    ? ` · ${org.active_members_count} member${org.active_members_count === 1 ? '' : 's'}`
                    : ''}
                </div>
              </TableCell>

              <TableCell className="font-mono text-sm tabular-nums">
                {org.bn_number || (
                  <span className="text-muted-foreground">Not given</span>
                )}
              </TableCell>

              <TableCell className="text-sm">
                <WaitingFor since={org.verification_requested_at ?? null} />
              </TableCell>

              <TableCell>
                {org.cac_document ? (
                  <div className="flex items-start gap-2">
                    <FileText
                      aria-hidden
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm" title={org.cac_document.original_name}>
                        {org.cac_document.original_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatSize(org.cac_document.size)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Badge variant="outline" className="gap-1 text-muted-foreground">
                    <FileWarning className="h-3 w-3" aria-hidden />
                    None
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * How long they have been waiting, in the words a person would use.
 *
 * The DURATION rather than the date, because the question this column answers
 * is "who have we kept waiting longest", not "what was the date". A date makes
 * the reader do the subtraction.
 */
function WaitingFor({ since }: { since: string | null }) {
  /**
   * BEFORE THE EARLY RETURNS, AND READ ONCE ON MOUNT. Two rules meet on this
   * line and the first fix broke the second. `Date.now()` in a render body is
   * an impure render — same props, different answer — which
   * `react-hooks/purity` refuses; a lazy initialiser fixes that. But putting it
   * after the "no date" guards made it conditional, which `rules-of-hooks`
   * refuses in turn. So it goes first, unconditionally, and costs nothing when
   * the guards return.
   *
   * A queue row does not need a duration that ticks. It needs the right answer
   * when the screen is opened.
   */
  const [now] = useState(() => Date.now());

  if (!since) return <span className="text-muted-foreground">Unknown</span>;

  const applied = new Date(since);
  if (Number.isNaN(applied.getTime())) {
    return <span className="text-muted-foreground">Unknown</span>;
  }

  const days = Math.floor((now - applied.getTime()) / 86_400_000);
  const label =
    days <= 0 ? 'Today' : days === 1 ? '1 day ago' : `${days} days ago`;

  return (
    <span className={days >= 3 ? 'font-medium text-amber-600 dark:text-amber-400' : undefined}>
      {label}
    </span>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

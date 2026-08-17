'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

import { AdminPagination } from '@/components/admin';
import { OrganizationVerificationsTable } from '@/components/admin/organization-verifications';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminOrganizationVerifications } from '@/lib/hooks/useAdminOrganizationVerifications';

/**
 * Admin → the organizations waiting to be verified.
 *
 * @arthur asked for this on 16 August 2026 and could not review anybody without
 * it: the approve and reject endpoints had existed since July and no screen in
 * the app called either, so the only route to a decision was asking a person
 * with database access to press it for him.
 *
 * ── THIS SCREEN LISTS. IT DOES NOT YET JUDGE ───────────────────────────────
 * Reviewing means reading the certificate, and on 17 August 2026 the
 * certificates turned out to be gone — written to a folder every deploy
 * deletes, for as long as the feature has existed. A review screen offering
 * "open document" today would 404 on every row.
 *
 * So the queue ships first and alone. It is the half that is true: who applied,
 * what number they gave, how long they have waited, and what they sent. The
 * judging half follows the storage fix rather than racing it.
 */
function OrganizationVerificationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const params = useMemo(
    () => ({
      page: Number(searchParams.get('page')) || 1,
      per_page: Number(searchParams.get('per_page')) || 15,
    }),
    [searchParams],
  );

  const { data, isPending } = useAdminOrganizationVerifications(params);

  const pagination = useMemo(() => {
    const p = data?.pagination;
    if (!p) return null;
    return {
      current_page: p.current_page,
      per_page: p.per_page,
      total: p.total,
      last_page: p.last_page,
      from: p.from ?? null,
      to: p.to ?? null,
    };
  }, [data]);

  const handlePageChange = useCallback(
    (page: number) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set('page', String(page));
      router.push(`/admin/organization-verifications?${next.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Organization verifications
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Companies that have applied and not yet been answered, longest wait
          first.
        </p>
      </div>

      {/* Stated on the screen rather than only in a channel, because the person
          using it will otherwise conclude the feature is broken. It comes out
          the moment the storage fix lands. */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-900/20">
        <AlertTriangle
          aria-hidden
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
        />
        <div className="space-y-1">
          <p className="font-medium">Documents cannot be opened yet</p>
          <p className="text-muted-foreground">
            Certificates uploaded before today were stored on a server that is
            rebuilt on every deploy, so the files are gone even though the
            records remain. Approving is on hold until storage is fixed and the
            companies below have sent their certificate again.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Waiting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <OrganizationVerificationsTable
            items={data?.data ?? []}
            isLoading={isPending}
          />

          {pagination && pagination.total > 0 ? (
            <AdminPagination
              pagination={pagination}
              onPageChange={handlePageChange}
              itemLabel="application"
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function OrganizationVerificationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
      <OrganizationVerificationsContent />
    </Suspense>
  );
}

'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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
 * ── IT LISTS; THE ROW OPENS THE ONE THAT JUDGES ────────────────────────────
 * Who applied, what number they gave, how long they have waited, and what they
 * sent. Tapping the company opens the screen the decision is made on.
 *
 * It shipped BEFORE that screen could open a certificate, because on 17 August
 * 2026 every certificate we had turned out to be gone — written to a folder
 * every deploy deletes. The storage fix landed the same evening and new
 * uploads survive; the older ones do not, and the review screen says so per
 * company rather than this list warning about all of them.
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

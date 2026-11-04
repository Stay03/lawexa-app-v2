'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import { TemplateDeleteDialog } from '@/components/admin/templates/TemplateDeleteDialog';
import { TemplatesFilters } from '@/components/admin/templates/TemplatesFilters';
import { TemplatesBulkApprove } from '@/components/admin/templates/TemplatesBulkApprove';
import { TemplatesTable } from '@/components/admin/templates/TemplatesTable';
import { NO_SELECTION, canTick, toggleDraft, togglePage, type DraftSelection } from '@/components/admin/templates/template-model';
import { TemplateUploadDialog } from '@/components/admin/templates/TemplateUploadDialog';
import { useAdminTemplateFacets, useAdminTemplates, useDownloadTemplateSource, useDraftCount } from '@/lib/hooks/useAdminTemplates';
import { useDebounce } from '@/lib/hooks/useDebounce';
import type { AdminTemplateListParams, AdminTemplateRow, AdminTemplateStatus } from '@/types/admin-templates';

/**
 * Templates — the documents Lawexa uses as models when it drafts (Stay's go,
 * 4 November 2026, thread 2b658111). Admins only. Upload several Word, RTF or
 * PDF files at once; each is a draft while Lawexa blanks out names, dates and
 * amounts and suggests its labels, and goes live once an admin approves it.
 * Only live templates reach Lawexa. The filters live in the address, as on
 * the other admin lists (Files). Drafts can be ticked and approved together,
 * or all drafts under the filters at once (Arthur, 4 November 2026).
 */
function AdminTemplatesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(searchValue, 300);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleting, setDeleting] = useState<{ uuid: string; name: string; live: boolean } | null>(null);
  const download = useDownloadTemplateSource();

  const params = useMemo<AdminTemplateListParams>(
    () => ({
      page: Number(searchParams.get('page')) || 1,
      per_page: Number(searchParams.get('per_page')) || 15,
      status: (searchParams.get('status') as AdminTemplateStatus | null) || undefined,
      practice_area: searchParams.get('practice_area') || undefined,
      document_type: searchParams.get('document_type') || undefined,
      country_id: searchParams.get('country_id') ? Number(searchParams.get('country_id')) : undefined,
      search: debouncedSearch || undefined,
    }),
    [searchParams, debouncedSearch],
  );

  const list = useAdminTemplates(params);
  const facets = useAdminTemplateFacets();

  // Bulk approve: the selection belongs to the filters it was made under, so a
  // change of filters starts a fresh one (a draft ticked under "Property" is not
  // quietly approved after switching to "Corporate").
  const filterKey = JSON.stringify([params.search, params.status, params.practice_area, params.document_type, params.country_id]);
  const [picked, setPicked] = useState<{ key: string; selection: DraftSelection }>({ key: filterKey, selection: NO_SELECTION });
  const selection = picked.key === filterKey ? picked.selection : NO_SELECTION;
  const setSelection = (next: DraftSelection) => setPicked({ key: filterKey, selection: next });
  const showsDrafts = !params.status || params.status === 'draft';
  const drafts = useDraftCount(params, showsDrafts);
  const pageDrafts = (list.data?.data ?? []).filter(canTick).map((row) => row.uuid);
  const ticked = (uuid: string) => selection.kind === 'all' || selection.uuids.has(uuid);
  const tickedOnPage = pageDrafts.filter(ticked).length;

  const updateParams = useCallback(
    (updates: Partial<AdminTemplateListParams>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      }
      const query = next.toString();
      router.push(query ? `/admin/templates?${query}` : '/admin/templates');
    },
    [router, searchParams],
  );

  // The search goes into the address once typing pauses.
  useEffect(() => {
    const current = searchParams.get('search') || '';
    if (debouncedSearch !== current) updateParams({ search: debouncedSearch || undefined, page: 1 });
  }, [debouncedSearch, searchParams, updateParams]);

  const filtered = Boolean(params.status || params.practice_area || params.document_type || params.country_id || params.search);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Documents Lawexa uses as models when it drafts. Only live templates are used.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="gap-1.5">
          <Upload aria-hidden className="size-4" />
          Upload templates
        </Button>
      </div>

      <TemplatesFilters
        params={params}
        facets={facets.data ?? undefined}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onParamsChange={updateParams}
      />

      {showsDrafts ? (
        <TemplatesBulkApprove selection={selection} onSelectionChange={setSelection} draftTotal={drafts.data ?? null} params={params} />
      ) : null}

      <TemplatesTable
        selection={{
          isTicked: ticked,
          onToggle: (uuid) => setSelection(toggleDraft(selection, uuid, pageDrafts)),
          page: tickedOnPage === 0 ? 'none' : tickedOnPage === pageDrafts.length ? 'all' : 'some',
          onTogglePage: () => setSelection(togglePage(selection, pageDrafts)),
        }}
        rows={list.data?.data ?? []}
        isLoading={list.isPending}
        filtered={filtered}
        onDownload={(row: AdminTemplateRow) => download.mutate({ uuid: row.uuid, name: row.source.original_name })}
        onDelete={(row: AdminTemplateRow) =>
          setDeleting({ uuid: row.uuid, name: row.name || row.source.original_name, live: row.status === 'live' })
        }
      />

      {list.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
          The templates did not load.{' '}
          <button type="button" className="font-medium underline underline-offset-2" onClick={() => void list.refetch()}>
            Try again
          </button>
        </div>
      ) : null}

      {list.data?.pagination ? (
        <AdminPagination
          pagination={list.data.pagination}
          onPageChange={(page) => updateParams({ page })}
          perPage={params.per_page || 15}
          onPerPageChange={(perPage) => updateParams({ per_page: perPage, page: 1 })}
          itemLabel="templates"
        />
      ) : null}

      <TemplateUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <TemplateDeleteDialog
        template={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      />
    </div>
  );
}

export default function AdminTemplatesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-[200px]" />
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-[260px]" />
            <Skeleton className="h-10 w-[140px]" />
            <Skeleton className="h-10 w-[180px]" />
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </div>
      }
    >
      <AdminTemplatesContent />
    </Suspense>
  );
}

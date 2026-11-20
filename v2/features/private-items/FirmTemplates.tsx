'use client';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Loader2, RotateCw, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { saveExportedFile } from '@/lib/certificates/save-file';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { firmTemplatesApi } from '@/lib/api/private-items';
import type { FirmTemplate } from '@/types/private-items';
import { SETTINGS_BLOCK } from '../settings/SettingsList';
import { DeleteItemDialog, RenameDialog } from './ItemDialogs';
import { privateItemsQueries, useFirmTemplateMutations } from './queries';
import { TemplateRow } from './TemplateRow';
import { UploadRefusals, useTemplateUpload } from './use-template-upload';

/**
 * Firm templates on the organization page (Stay, thread 9ae498ae): templates
 * an organization's owner or admins upload, which Lawexa uses in every
 * member's chats with no Lawexa admin approval (Stay, 19 November 2026).
 * Every member sees the list and can download; only owners and admins add,
 * rename, retry or delete.
 */
export function FirmTemplates({ organizationUuid, canManage }: { organizationUuid: string; canManage: boolean }) {
  const query = useInfiniteQuery(privateItemsQueries.firmTemplates(organizationUuid));
  const mutations = useFirmTemplateMutations(organizationUuid);
  const upload = useTemplateUpload((files) => mutations.upload.mutateAsync(files));
  const [renaming, setRenaming] = useState<FirmTemplate | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<FirmTemplate | null>(null);

  const rows = query.data?.pages.flatMap((page) => page.data) ?? [];

  const download = async (row: FirmTemplate) => {
    try {
      saveExportedFile({ blob: await firmTemplatesApi.download(organizationUuid, row.uuid), filename: row.file?.original_name ?? row.name });
    } catch (error) {
      toast.error(extractApiError(error).message || 'The file did not download.');
    }
  };

  return (
    <section aria-labelledby="firm-templates-heading" className="mt-8">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 id="firm-templates-heading" className="text-base font-semibold text-foreground">
            Firm templates
          </h2>
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
            Lawexa drafts from these in every member&rsquo;s chats.
          </p>
        </div>
        {canManage ? (
          <Button size="sm" variant="outline" onClick={upload.pick} disabled={upload.uploading} className="shrink-0 rounded-full">
            {upload.uploading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Upload aria-hidden className="size-4" />}
            {upload.uploading ? 'Uploading…' : 'Upload'}
          </Button>
        ) : null}
      </div>
      {upload.input}
      <div className="mt-3">
        <UploadRefusals lines={upload.lines} />
      </div>

      {query.isPending ? (
        <Skeleton aria-hidden className="h-32 w-full rounded-2xl" />
      ) : query.isError ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>The firm&rsquo;s templates did not load.</span>
          <Button size="sm" variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RotateCw aria-hidden className={cn('size-4', query.isFetching && 'animate-spin')} />
            Try again
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl bg-secondary/50 px-4 py-6 text-center text-sm text-muted-foreground">
          {canManage
            ? 'No firm templates yet. Upload a Word or PDF document and every member’s Lawexa can draft from it.'
            : 'No firm templates yet. Your organization’s owner or admins can add them.'}
        </p>
      ) : (
        <ul className={SETTINGS_BLOCK}>
          {rows.map((row) => (
            <TemplateRow
              key={row.uuid}
              row={row}
              manage={canManage}
              onRename={() => {
                setRenameError(null);
                setRenaming(row);
              }}
              onDownload={() => void download(row)}
              onRetry={() => mutations.retry.mutate(row.uuid, { onError: (error) => toast.error(extractApiError(error).message) })}
              onDelete={() => setDeleting(row)}
              below={
                row.uploaded_by ? (
                  <span className="mt-0.5 text-[12px] leading-snug text-muted-foreground">Added by {row.uploaded_by.name}</span>
                ) : null
              }
            />
          ))}
        </ul>
      )}

      {query.hasNextPage ? (
        <div className="mt-3 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            {query.isFetchingNextPage ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Show more
          </Button>
        </div>
      ) : null}

      {renaming ? (
        <RenameDialog
          key={renaming.uuid}
          open
          current={renaming.name}
          pending={mutations.rename.isPending}
          error={renameError}
          onClose={() => setRenaming(null)}
          onSave={(name) =>
            mutations.rename.mutate(
              { uuid: renaming.uuid, name },
              { onSuccess: () => setRenaming(null), onError: (error) => setRenameError(extractApiError(error).message) },
            )
          }
        />
      ) : null}
      {deleting ? (
        <DeleteItemDialog
          open
          kind="template"
          name={deleting.name}
          spaces={0}
          pending={mutations.remove.isPending}
          onClose={() => setDeleting(null)}
          onDelete={() =>
            mutations.remove.mutate(deleting.uuid, {
              onSuccess: () => {
                toast.success(`${deleting.name} deleted.`);
                setDeleting(null);
              },
              onError: (error) => toast.error(extractApiError(error).message),
            })
          }
        />
      ) : null}
    </section>
  );
}

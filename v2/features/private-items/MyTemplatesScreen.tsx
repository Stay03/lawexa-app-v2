'use client';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { FileText, Loader2, RotateCw, TriangleAlert, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { saveExportedFile } from '@/lib/certificates/save-file';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { myTemplatesApi } from '@/lib/api/private-items';
import type { MyTemplate } from '@/types/private-items';
import { SETTINGS_COLUMN } from '../settings/SettingsList';
import { SettingsFormGroup } from '../settings/SettingsForm';
import { SettingsState } from '../settings/SettingsState';
import { AllowedInChips } from './AllowedInChips';
import { DeleteItemDialog, RenameDialog } from './ItemDialogs';
import { privateItemsQueries, useTemplateMutations } from './queries';
import { ItemsFallback } from './states';
import { TemplateRow } from './TemplateRow';
import { UploadRefusals, useTemplateUpload } from './use-template-upload';

/**
 * Settings > My templates (Stay, thread 9ae498ae): a person's own document
 * templates. Lawexa reads each file and marks its blanks, the same way it
 * reads an admin's template; then it drafts from it in that person's own
 * chats. In a Space it asks first, and the Spaces where they said "always"
 * show under the template with × to take it back.
 */
export function MyTemplatesScreen() {
  const query = useInfiniteQuery(privateItemsQueries.myTemplates());
  const mutations = useTemplateMutations();
  const upload = useTemplateUpload((files) => mutations.upload.mutateAsync(files));
  const [renaming, setRenaming] = useState<MyTemplate | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<MyTemplate | null>(null);

  const rows = query.data?.pages.flatMap((page) => page.data) ?? [];

  const download = async (row: MyTemplate) => {
    try {
      saveExportedFile({ blob: await myTemplatesApi.download(row.uuid), filename: row.file.original_name });
    } catch (error) {
      toast.error(extractApiError(error).message || 'The file did not download.');
    }
  };

  const uploadButton = (
    <Button onClick={upload.pick} disabled={upload.uploading} className="rounded-full">
      {upload.uploading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Upload aria-hidden className="size-4" />}
      {upload.uploading ? 'Uploading…' : 'Upload a template'}
    </Button>
  );

  return (
    <div className={SETTINGS_COLUMN}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">My templates</h1>
        {rows.length > 0 ? uploadButton : null}
      </div>
      {upload.input}
      <UploadRefusals lines={upload.lines} />

      {query.isPending ? (
        <ItemsFallback label="Loading your templates" />
      ) : query.isError ? (
        <SettingsState
          icon={TriangleAlert}
          tone="alarm"
          title="Your templates did not load"
          description="Check your connection and try again."
          action={
            <Button size="sm" variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RotateCw aria-hidden className={cn('size-4', query.isFetching && 'animate-spin')} />
              Try again
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <SettingsState
          icon={FileText}
          title="No templates yet"
          description="Upload a Word or PDF document. Lawexa marks its names, dates and amounts as blanks, then drafts from it in your chats."
          action={uploadButton}
        />
      ) : (
        <SettingsFormGroup
          id="my-templates"
          label="Your templates"
          description="Only your chats use these. In a Space, Lawexa asks you first."
        >
          {rows.map((row) => (
            <TemplateRow
              key={row.uuid}
              row={row}
              manage
              onRename={() => {
                setRenameError(null);
                setRenaming(row);
              }}
              onDownload={() => void download(row)}
              onRetry={() => mutations.retry.mutate(row.uuid, { onError: (error) => toast.error(extractApiError(error).message) })}
              onDelete={() => setDeleting(row)}
              below={<AllowedInChips allowedIn={row.allowed_in} itemName={row.name} />}
            />
          ))}
        </SettingsFormGroup>
      )}

      {query.hasNextPage ? (
        <div className="mt-4 flex justify-center">
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
          spaces={deleting.allowed_in.length}
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
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { Loader2, ScanText } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageReaders, useUpdatePageReaders } from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminPageReaders } from '@/types/admin-ai';
import {
  NO_BACKUP,
  pageReadersError,
  pageReadersPayload,
  pageReadersSaved,
  pageReadersStart,
  readerChoices,
} from './page-readers-model';

/**
 * PageReadersCard — which AI models read scanned PDF pages and statutes into
 * text, at the top of the admin AI Models page (Stay, 1 November 2026: Claude
 * Haiku 5.5, settable in the admin pages). Two choices from the models that
 * read pictures: the first reads every page, the optional backup reads a page
 * the first fails on. The rules are `page-readers-model.ts`.
 */
export function PageReadersCard() {
  const readers = usePageReaders();
  const data = readers.data?.data;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <ScanText aria-hidden className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Page readers</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The models that read scanned PDF pages and statutes into text. Only models that read pictures are listed.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {readers.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : data ? (
          <PageReadersForm data={data} />
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Couldn’t load the page readers. Reload the page to try again.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PageReadersForm({ data }: { data: AdminPageReaders }) {
  const update = useUpdatePageReaders();
  const choices = useMemo(() => readerChoices(data), [data]);
  // The admin's edits over the saved choice; null when untouched. A refetch
  // (another admin's save, a refocus) moves an untouched form to the new
  // choice and leaves unsaved edits alone (techlead's review, 1 November 2026).
  const [edits, setEdits] = useState<{ first: string; backup: string } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const saved = pageReadersStart(data);
  const { first, backup } = edits ?? saved;
  const dirty = first !== saved.first || backup !== saved.backup;
  const error = pageReadersError(first, backup) ?? serverError;

  const change = (next: { first: string; backup: string }) => {
    setEdits(next);
    setServerError(null);
  };

  const save = () => {
    if (pageReadersError(first, backup)) return;
    const payload = pageReadersPayload(first, backup);
    setServerError(null);
    update.mutate(payload, {
      onSuccess: () => {
        setEdits(null);
        toast.success('Page readers saved.', { description: pageReadersSaved(choices, payload) });
      },
      onError: (failure) => {
        const apiError = extractApiError(failure);
        setServerError(apiError.errors?.first?.[0] ?? apiError.message);
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="page-reader-first">Reads scanned pages first</Label>
          <Select value={first} onValueChange={(value) => change({ first: value, backup })}>
            <SelectTrigger id="page-reader-first">
              <SelectValue placeholder="Choose a model" />
            </SelectTrigger>
            <SelectContent>
              {choices.map((option) => (
                <SelectItem key={option.reader} value={option.reader}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="page-reader-backup">Backup (used when the first fails on a page)</Label>
          <Select value={backup} onValueChange={(value) => change({ first, backup: value })}>
            <SelectTrigger id="page-reader-backup">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_BACKUP}>No backup</SelectItem>
              {choices.map((option) => (
                <SelectItem key={option.reader} value={option.reader}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={!dirty || update.isPending}
          onClick={() => {
            setEdits(null);
            setServerError(null);
          }}
        >
          Discard
        </Button>
        <Button type="button" disabled={!dirty || update.isPending || error !== null} onClick={save}>
          {update.isPending ? <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save page readers
        </Button>
      </div>
    </div>
  );
}

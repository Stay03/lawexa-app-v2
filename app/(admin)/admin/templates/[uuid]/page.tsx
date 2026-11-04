'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Download, Loader2, RotateCw, Trash2, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { TemplateDeleteDialog } from '@/components/admin/templates/TemplateDeleteDialog';
import { TemplateStatusBadge } from '@/components/admin/templates/TemplatesTable';
import {
  approveBlocker,
  blankSegments,
  blanksIn,
  blanksLabel,
  changedFields,
  fieldsOf,
  type TemplateFields,
} from '@/components/admin/templates/template-model';
import { useCountries } from '@/lib/hooks/useAdminCases';
import {
  useAdminTemplate,
  useAdminTemplateFacets,
  useDownloadTemplateSource,
  useTemplateAction,
  useUpdateTemplate,
} from '@/lib/hooks/useAdminTemplates';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import type { AdminTemplateDetail } from '@/types/admin-templates';

const NO_COUNTRY = '_none';

/**
 * Review a draft, or edit a live template (Stay's go 4 November 2026, thread
 * 2b658111): the blanked text, editable, beside the labels Lawexa suggested,
 * editable, then "Approve, make live" or Delete. A file Lawexa could not read
 * says why, with Try again. The text is plain text (Backend): a blank is
 * capitals in square brackets, [PARTY A]; the admin adds one by typing it and
 * removes one by writing over it, and the list beside the text shows them.
 */
export default function AdminTemplateReviewPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = use(params);
  const template = useAdminTemplate(uuid);

  // The breadcrumb names the template, not its id.
  const { setOverride, clearOverride } = useBreadcrumbStore();
  const title = template.data ? template.data.name || template.data.source.original_name : null;
  useEffect(() => {
    if (title) setOverride(uuid, title);
    return () => clearOverride(uuid);
  }, [title, uuid, setOverride, clearOverride]);

  if (template.isPending) return <ReviewSkeleton />;
  if (template.isError || !template.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-lg border py-12 text-center text-muted-foreground">
          This template did not load. It may have been deleted.{' '}
          <button type="button" className="font-medium text-foreground underline underline-offset-2" onClick={() => void template.refetch()}>
            Try again
          </button>
        </div>
      </div>
    );
  }
  // Keyed on the status, so a retry or a finished reading starts the form from the server's copy. A save
  // keeps the form (its fields then match what was saved), so "Approve, make live" can save and approve in one go.
  return <TemplateReview key={`${template.data.uuid}:${template.data.status}`} detail={template.data} />;
}

function TemplateReview({ detail }: { detail: AdminTemplateDetail }) {
  const router = useRouter();
  const saved = useMemo(() => fieldsOf(detail), [detail]);
  const [fields, setFields] = useState<TemplateFields>(saved);
  const [deleting, setDeleting] = useState(false);
  const facets = useAdminTemplateFacets();
  const countries = useCountries({ per_page: 300, sort: 'name', order: 'asc' });
  const update = useUpdateTemplate(detail.uuid);
  const approve = useTemplateAction(detail.uuid, 'approve');
  const unpublish = useTemplateAction(detail.uuid, 'unpublish');
  const retry = useTemplateAction(detail.uuid, 'retry');
  const download = useDownloadTemplateSource();

  const changes = changedFields(saved, fields);
  const dirty = Object.keys(changes).length > 0;
  const processing = detail.status === 'processing';
  const live = detail.status === 'live';
  const blocker = approveBlocker(detail.status, fields);
  const blanks = blanksIn(fields.text);
  const busy = update.isPending || approve.isPending || unpublish.isPending || retry.isPending;
  const set = <K extends keyof TemplateFields>(key: K, value: TemplateFields[K]) => setFields((current) => ({ ...current, [key]: value }));

  // Approve saves the edits first, so what goes live is what the admin sees.
  const makeLive = async () => {
    if (dirty) await update.mutateAsync(changes);
    approve.mutate();
  };

  const countryList = countries.data?.data ?? [];

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{detail.name || detail.source.original_name}</h1>
            <TemplateStatusBadge status={detail.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            From {detail.source.original_name}
            {detail.uploaded_by ? `, uploaded by ${detail.uploaded_by.name}` : ''}
            {detail.reviewed_by && detail.reviewed_at
              ? ` · made live by ${detail.reviewed_by.name} on ${new Date(detail.reviewed_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={download.isPending}
            onClick={() => download.mutate({ uuid: detail.uuid, name: detail.source.original_name })}
          >
            <Download aria-hidden className="size-4" />
            Original file
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setDeleting(true)}>
            <Trash2 aria-hidden className="size-4" />
            Delete
          </Button>
        </div>
      </div>

      {detail.status === 'failed' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
          <span>{detail.error || 'Lawexa could not read this file.'}</span>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={retry.isPending} onClick={() => retry.mutate()}>
            <RotateCw aria-hidden className="size-4" />
            Try again
          </Button>
        </div>
      ) : null}

      {processing ? (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-400">
          <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
          Lawexa is reading this file, blanking out names, dates and amounts and suggesting its labels. This usually takes under a minute.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* The text: the blanked template, editable, and what was read from the file. */}
        <Tabs defaultValue="template" className="min-w-0">
          <TabsList>
            <TabsTrigger value="template">Template</TabsTrigger>
            <TabsTrigger value="original">Original text</TabsTrigger>
          </TabsList>
          <TabsContent value="template" className="space-y-2">
            <Label htmlFor="template-text" className="sr-only">
              Template text
            </Label>
            <Textarea
              id="template-text"
              value={fields.text}
              onChange={(event) => set('text', event.target.value)}
              disabled={processing}
              className="min-h-[520px] font-sans text-sm leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              Plain text. A blank is capitals in square brackets, like [PARTY A] or [DATE]. Type one to add it; write over one to remove it.
            </p>
          </TabsContent>
          <TabsContent value="original">
            <div className="max-h-[560px] overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
              {detail.original_text || <span className="text-muted-foreground">Nothing was read from this file.</span>}
            </div>
          </TabsContent>
        </Tabs>

        {/* The labels Lawexa suggested, and the blanks in the text. */}
        <div className="space-y-5">
          <div className="space-y-4 rounded-lg border p-4">
            <p className="text-sm font-medium">Labels</p>
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Name</Label>
              <Input id="template-name" value={fields.name} onChange={(event) => set('name', event.target.value)} disabled={processing} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-area">Practice area</Label>
              <Input
                id="template-area"
                list="template-area-options"
                value={fields.practice_area}
                onChange={(event) => set('practice_area', event.target.value)}
                disabled={processing}
              />
              <datalist id="template-area-options">
                {(facets.data?.practice_areas ?? []).map((area) => (
                  <option key={area} value={area} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-type">Document type</Label>
              <Input
                id="template-type"
                list="template-type-options"
                value={fields.document_type}
                onChange={(event) => set('document_type', event.target.value)}
                disabled={processing}
              />
              <datalist id="template-type-options">
                {(facets.data?.document_types ?? []).map((type) => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-country">Country</Label>
              <Select
                value={fields.country_id === null ? NO_COUNTRY : String(fields.country_id)}
                onValueChange={(value) => set('country_id', value === NO_COUNTRY ? null : Number(value))}
                disabled={processing}
              >
                <SelectTrigger id="template-country">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COUNTRY}>No country</SelectItem>
                  {/* The saved country stays a choice before the list has loaded. */}
                  {detail.country && !countryList.some((country) => country.id === detail.country?.id) ? (
                    <SelectItem value={String(detail.country.id)}>{detail.country.name}</SelectItem>
                  ) : null}
                  {countryList.map((country) => (
                    <SelectItem key={country.id} value={String(country.id)}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border p-4">
            <p className="text-sm font-medium">{blanksLabel(blanks.length)}</p>
            {blanks.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {blanks.map((blank) => (
                  <li key={blank} className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs text-foreground">
                    {blank}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Lawexa found nothing to blank out. Add blanks in the text if the template needs them.</p>
            )}
          </div>

          <div className="space-y-2">
            {live ? (
              <>
                <Button className="w-full" disabled={!dirty || busy} onClick={() => update.mutate(changes)}>
                  {update.isPending ? <Loader2 aria-hidden className="mr-2 size-4 animate-spin motion-reduce:animate-none" /> : null}
                  Save changes
                </Button>
                <Button variant="outline" className="w-full gap-1.5" disabled={busy} onClick={() => unpublish.mutate()}>
                  <Undo2 aria-hidden className="size-4" />
                  Make it a draft again
                </Button>
                <p className="text-xs text-muted-foreground">This template is live: Lawexa uses it when it drafts. Saved changes apply at once.</p>
              </>
            ) : (
              <>
                <Button className="w-full gap-1.5" disabled={blocker !== null || busy} onClick={() => void makeLive()}>
                  {approve.isPending ? <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <CheckCircle2 aria-hidden className="size-4" />}
                  Approve, make live
                </Button>
                <Button variant="outline" className="w-full" disabled={!dirty || busy || processing} onClick={() => update.mutate(changes)}>
                  Save as draft
                </Button>
                {blocker ? <p className="text-xs text-muted-foreground">{blocker}</p> : null}
                {!blocker && detail.status === 'draft' ? (
                  <Button variant="ghost" size="sm" className="w-full gap-1.5 text-muted-foreground" disabled={busy} onClick={() => retry.mutate()}>
                    <RotateCw aria-hidden className="size-4" />
                    Read the file again
                  </Button>
                ) : null}
              </>
            )}
          </div>

          <TemplatePreview text={fields.text} />
        </div>
      </div>

      <TemplateDeleteDialog
        template={deleting ? { uuid: detail.uuid, name: detail.name || detail.source.original_name, live } : null}
        onOpenChange={(open) => {
          if (!open) setDeleting(false);
        }}
        onDeleted={() => router.push('/admin/templates')}
      />
    </div>
  );
}

/** The first lines of the text with its blanks marked, so a missed or wrong blank stands out. */
function TemplatePreview({ text }: { text: string }) {
  const head = text.slice(0, 1200);
  if (!head.trim()) return null;
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <p className="text-sm font-medium">Preview</p>
      <p className="max-h-60 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
        {blankSegments(head).map((segment, index) =>
          segment.blank ? (
            <mark key={index} className="rounded bg-primary/15 px-0.5 text-foreground">
              {segment.text}
            </mark>
          ) : (
            <span key={index}>{segment.text}</span>
          ),
        )}
        {text.length > head.length ? '…' : null}
      </p>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/admin/templates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft aria-hidden className="size-4" />
      Templates
    </Link>
  );
}

function ReviewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-8 w-72" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-[520px] w-full" />
        <Skeleton className="h-[360px] w-full" />
      </div>
    </div>
  );
}

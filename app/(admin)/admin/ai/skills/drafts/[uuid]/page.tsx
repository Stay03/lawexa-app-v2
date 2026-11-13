'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { AlertTriangle, ArrowLeft, Loader2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SkillDraftEditSheet } from '@/components/admin/ai/SkillDraftEditSheet';
import { SkillDraftRejectDialog } from '@/components/admin/ai/SkillDraftRejectDialog';
import { SkillInstructionsDiff } from '@/components/admin/ai/SkillInstructionsDiff';
import {
  DRAFT_STATUS_LABEL,
  changedFields,
  draftKindLine,
  draftSourceLine,
  publishProblem,
  type PublishProblem,
} from '@/components/admin/ai/skill-draft-model';
import { LOAD_MODE_LABEL } from '@/components/admin/ai/skill-model';
import { useAdminSkillDraft, usePublishSkillDraft } from '@/lib/hooks/useAdminAi';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { SkillDraft, SkillDraftLive } from '@/types/skill-draft';

/**
 * One skill draft (the skills tool, thread 2b436b4f): the draft beside the
 * live skill, its steps marked against the live ones, and the decision. While
 * it waits: Edit, Reject (with a note) and Publish. A publish the server
 * refuses because the live skill moved on since the draft (409) offers
 * "Publish over the newer version"; when the live skill moved on, the page
 * says so up front and shows what changed since the version it was drafted
 * against.
 */
export default function SkillDraftPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = use(params);
  const { data, isLoading, error } = useAdminSkillDraft(uuid);
  const { setOverride, clearOverride } = useBreadcrumbStore();
  const publish = usePublishSkillDraft(uuid);
  const [problem, setProblem] = useState<PublishProblem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const title = data?.data?.display_name;
  useEffect(() => {
    if (title) setOverride(uuid, title);
    return () => clearOverride(uuid);
  }, [title, uuid, setOverride, clearOverride]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const back = (
    <Link href="/admin/ai/skills/drafts">
      <Button variant="ghost" size="sm">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Drafts
      </Button>
    </Link>
  );

  if (error || !data?.data) {
    return (
      <div className="space-y-4">
        {back}
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {extractApiError(error).status === 404 ? 'This draft is not waiting for review here.' : 'The draft could not be loaded.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const draft = data.data;
  const waiting = draft.status === 'pending';

  const runPublish = (overNewer: boolean) => {
    setProblem(null);
    publish.mutate(overNewer, {
      onSuccess: (response) => toast.success(response.message),
      onError: (failure) => setProblem(publishProblem(extractApiError(failure))),
    });
  };

  return (
    <div className="space-y-6">
      {back}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="break-words">{draft.display_name}</CardTitle>
              <CardDescription className="mt-1 space-y-0.5">
                <span className="text-xs">{draftKindLine(draft)}</span>
                {draft.kind === 'new' && draft.name ? <span className="font-mono text-xs"> &middot; {draft.name}</span> : null}
                <p className="text-xs">
                  {draftSourceLine(draft)}
                  {draft.created_at ? `, ${format(new Date(draft.created_at), 'd MMM yyyy, HH:mm')}` : ''}
                </p>
                <p className="mt-1 text-sm">{draft.description}</p>
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Badge variant={waiting ? 'default' : 'secondary'}>{DRAFT_STATUS_LABEL[draft.status]}</Badge>
              <Badge variant="outline">{LOAD_MODE_LABEL[draft.load_mode]}</Badge>
            </div>
          </div>
          {waiting ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => runPublish(false)} disabled={publish.isPending}>
                {publish.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Publish
              </Button>
              <Button variant="outline" onClick={() => setEditOpen(true)} disabled={publish.isPending}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button variant="outline" onClick={() => setRejectOpen(true)} disabled={publish.isPending}>
                <X className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </div>
          ) : (
            <Decision draft={draft} />
          )}
          {problem ? <PublishProblemNote problem={problem} onPublishOver={() => runPublish(true)} busy={publish.isPending} /> : null}
        </CardHeader>
      </Card>

      {draft.live?.changed_since_draft ? (
        <div role="note" className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            The live skill is now at version {draft.live.version}, newer than version {draft.base_version} this draft was
            written against. The steps below are compared with the live version; what changed since the draft was written
            is shown under them. Publishing replaces the newer version.
          </p>
        </div>
      ) : null}

      {draft.change_note ? (
        <p className="rounded-lg border px-4 py-3 text-sm">
          <span className="font-medium">Change note: </span>
          {draft.change_note}
        </p>
      ) : null}

      {draft.kind === 'change' && draft.live ? <ChangeView draft={draft} live={draft.live} /> : <NewSkillView draft={draft} />}

      {waiting ? (
        <>
          <SkillDraftEditSheet key={`${draft.uuid}-${draft.updated_at}`} open={editOpen} onOpenChange={setEditOpen} draft={draft} />
          <SkillDraftRejectDialog key={`reject-${draft.uuid}`} open={rejectOpen} onOpenChange={setRejectOpen} draft={draft} />
        </>
      ) : null}
    </div>
  );
}

/** What was decided, by whom, with the note. */
function Decision({ draft }: { draft: SkillDraft }) {
  if (draft.status !== 'published' && draft.status !== 'rejected') return null;
  const who = draft.reviewed_by?.name ?? 'an admin';
  const when = draft.reviewed_at ? format(new Date(draft.reviewed_at), 'd MMM yyyy, HH:mm') : null;
  return (
    <div className="mt-4 space-y-1 text-sm">
      <p>
        {draft.status === 'published'
          ? `Published${draft.published_version ? ` as version ${draft.published_version}` : ''} by ${who}`
          : `Rejected by ${who}`}
        {when ? `, ${when}` : ''}.
      </p>
      {draft.review_note ? <p className="text-muted-foreground">Note: {draft.review_note}</p> : null}
    </div>
  );
}

/** A refused publish: the server's sentence, and for a live skill that moved on, the way to publish over it. */
function PublishProblemNote({ problem, onPublishOver, busy }: { problem: PublishProblem; onPublishOver: () => void; busy: boolean }) {
  return (
    <div role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p>{problem.message}</p>
      {problem.kind === 'newer' ? (
        <Button className="mt-3" variant="destructive" size="sm" onClick={onPublishOver} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Publish over the newer version
        </Button>
      ) : null}
    </div>
  );
}

const FIELD_LABEL = { display_name: 'Display name', description: 'Description', load_mode: 'Load mode' } as const;

/** A change: the short fields beside the live skill's, then the steps marked line by line. */
function ChangeView({ draft, live }: { draft: SkillDraft; live: SkillDraftLive }) {
  const changed = new Set(changedFields(draft));
  const value = (field: keyof typeof FIELD_LABEL, of: 'draft' | 'live') => {
    const source = of === 'draft' ? draft : live;
    return field === 'load_mode' ? LOAD_MODE_LABEL[source.load_mode] : source[field];
  };
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Beside the live skill (version {live.version})</CardTitle>
          {live.deleted ? <CardDescription className="text-destructive">The live skill has been deleted.</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {(Object.keys(FIELD_LABEL) as Array<keyof typeof FIELD_LABEL>).map((field) => (
            <div key={field} className={cn('grid gap-2 rounded-md p-2 text-sm sm:grid-cols-[9rem_1fr_1fr]', changed.has(field) && 'bg-amber-500/10')}>
              <span className="font-medium">
                {FIELD_LABEL[field]}
                {changed.has(field) ? <span className="ml-1 text-xs font-normal text-amber-700 dark:text-amber-400">changed</span> : null}
              </span>
              <span>
                <span className="block text-xs text-muted-foreground">Draft</span>
                {value(field, 'draft')}
              </span>
              <span>
                <span className="block text-xs text-muted-foreground">Live</span>
                {value(field, 'live')}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Steps: the live version against this draft</CardTitle>
        </CardHeader>
        <CardContent>
          <SkillInstructionsDiff before={live.instructions} after={draft.instructions} />
        </CardContent>
      </Card>
      {draft.base ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              What changed in the live skill since version {draft.base.version}, which this draft was written against
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SkillInstructionsDiff before={draft.base.instructions} after={live.instructions} />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

/** A new skill: its steps in full. */
function NewSkillView({ draft }: { draft: SkillDraft }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Steps</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap break-words rounded-md border p-3 font-mono text-xs leading-relaxed">
          {draft.instructions}
        </pre>
      </CardContent>
    </Card>
  );
}

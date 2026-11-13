'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { Upload } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SkillImportDialog } from '@/components/admin/ai/SkillImportDialog';
import { SkillsTabs } from '@/components/admin/ai/SkillsTabs';
import { DRAFT_STATUS_LABEL, draftKindLine, draftSourceLine } from '@/components/admin/ai/skill-draft-model';
import { useAdminSkillDrafts } from '@/lib/hooks/useAdminAi';
import type { AdminSkillDraftListStatus } from '@/types/skill-draft';

const STATUSES: readonly AdminSkillDraftListStatus[] = ['pending', 'published', 'rejected'];

/**
 * Admin › AI › Skills › Drafts (the skills tool, thread 2b436b4f): skills
 * people saved from their chats, and SKILL.md zips imported here, waiting to
 * be published or rejected; and the ones already decided. A person's unsaved
 * draft is never listed.
 */
function SkillDraftsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get('status');
  const status: AdminSkillDraftListStatus = STATUSES.includes(statusParam as AdminSkillDraftListStatus)
    ? (statusParam as AdminSkillDraftListStatus)
    : 'pending';
  const page = Number(searchParams.get('page')) || 1;
  const { data, isLoading, isError } = useAdminSkillDrafts(status, page);
  const [importOpen, setImportOpen] = useState(false);

  const go = (next: { status?: AdminSkillDraftListStatus; page?: number }) => {
    const params = new URLSearchParams();
    const nextStatus = next.status ?? status;
    if (nextStatus !== 'pending') params.set('status', nextStatus);
    if ((next.page ?? 1) > 1) params.set('page', String(next.page));
    const query = params.toString();
    router.push(query ? `/admin/ai/skills/drafts?${query}` : '/admin/ai/skills/drafts');
  };

  const drafts = data?.data.drafts ?? [];
  const pagination = data?.data.pagination;

  return (
    <div className="space-y-6">
      <SkillsTabs active="drafts" />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-4">
          <div>
            <CardTitle>Skill drafts</CardTitle>
            <CardDescription className="mt-1.5">
              Skills Lawexa drafted in a chat and the person saved, and SKILL.md zips imported here. Publish one to
              make a skill version, or reject it.
            </CardDescription>
          </div>
          <Button onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import SKILL.md zip
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div role="tablist" aria-label="Draft status" className="flex flex-wrap gap-2">
            {STATUSES.map((value) => (
              <Button
                key={value}
                role="tab"
                aria-selected={status === value}
                size="sm"
                variant={status === value ? 'default' : 'outline'}
                onClick={() => go({ status: value })}
              >
                {DRAFT_STATUS_LABEL[value]}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : isError ? (
            <p role="alert" className="py-8 text-center text-sm text-destructive">
              The drafts could not be loaded. Try again.
            </p>
          ) : drafts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {status === 'pending' ? 'No drafts waiting for review.' : `No ${DRAFT_STATUS_LABEL[status].toLowerCase()} drafts.`}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Skill</TableHead>
                  <TableHead className="hidden md:table-cell">From</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drafts.map((draft) => (
                  <TableRow key={draft.uuid} className="cursor-pointer" onClick={() => router.push(`/admin/ai/skills/drafts/${draft.uuid}`)}>
                    <TableCell>
                      <Link href={`/admin/ai/skills/drafts/${draft.uuid}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                        {draft.display_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{draftKindLine(draft)}</p>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{draftSourceLine(draft)}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {draft.created_at ? format(new Date(draft.created_at), 'd MMM yyyy, HH:mm') : ''}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={draft.status === 'pending' ? 'default' : 'secondary'}>{DRAFT_STATUS_LABEL[draft.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {pagination && pagination.last_page > 1 ? (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {pagination.current_page} of {pagination.last_page} · {pagination.total} drafts
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={pagination.current_page <= 1} onClick={() => go({ page: pagination.current_page - 1 })}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.current_page >= pagination.last_page}
                  onClick={() => go({ page: pagination.current_page + 1 })}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <SkillImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

export default function SkillDraftsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <SkillDraftsContent />
    </Suspense>
  );
}

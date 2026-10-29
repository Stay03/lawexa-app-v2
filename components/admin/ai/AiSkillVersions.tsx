'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Eye, History, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AdminPagination } from '@/components/admin';
import { LoadFailed } from '@/components/admin/case-enrichments/LoadFailed';
import {
  useAdminAiSkillVersion,
  useAdminAiSkillVersions,
  useRestoreAiSkillVersion,
} from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import { cn } from '@/lib/utils';
import type { AdminAiSkillDetail, AdminAiSkillVersion } from '@/types/admin-ai';
import { diffSummary, lineDiff, LOAD_MODE_LABEL, restoredMessage, restoreQuestion } from './skill-model';

/**
 * A skill's history, newest first: every create, edit and restore is a
 * version (woz's server). "View" shows a version's steps against the current
 * ones as a plain line diff; "Restore" asks first, then saves that version as
 * a new one, so the history is never rewritten.
 */
export function AiSkillVersions({ skill }: { skill: AdminAiSkillDetail }) {
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<number | null>(null);
  const [restoring, setRestoring] = useState<AdminAiSkillVersion | null>(null);
  const { data, isLoading, isError, isFetching, refetch } = useAdminAiSkillVersions(skill.id, page);
  const restoreMutation = useRestoreAiSkillVersion();

  const restore = () => {
    if (!restoring) return;
    restoreMutation.mutate(
      { id: skill.id, version: restoring.version },
      {
        onSuccess: (response) => {
          toast.success(
            response.data ? restoredMessage(restoring.version, skill.version, response.data.version) : response.message,
          );
          setRestoring(null);
        },
        onError: (error) => toast.error(extractApiError(error).message),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-4 w-4" />
          Versions
        </CardTitle>
        <CardDescription>Every save is a version. Restoring one saves it again as the newest.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isError && !data ? (
          <LoadFailed message="The versions did not load." onRetry={() => refetch()} retrying={isFetching} />
        ) : isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[90px] font-semibold">Version</TableHead>
                  <TableHead className="w-[170px] font-semibold">Saved</TableHead>
                  <TableHead className="w-[150px] font-semibold">By</TableHead>
                  <TableHead className="w-[110px] font-semibold">Load mode</TableHead>
                  <TableHead className="font-semibold">Change note</TableHead>
                  <TableHead className="w-[190px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.data ?? []).map((version) => {
                  const current = version.version === skill.version;
                  return (
                    <TableRow key={version.version}>
                      <TableCell className="tabular-nums">
                        v{version.version}
                        {current ? (
                          <Badge variant="secondary" className="ml-2">
                            Current
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(version.created_at), 'PPp')}
                      </TableCell>
                      <TableCell className="text-sm">{version.created_by?.name ?? 'Deleted account'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{LOAD_MODE_LABEL[version.load_mode]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{version.change_note || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setViewing(version.version)}>
                            <Eye className="mr-1.5 h-4 w-4" />
                            View
                          </Button>
                          {current ? null : (
                            <Button variant="ghost" size="sm" onClick={() => setRestoring(version)}>
                              <RotateCcw className="mr-1.5 h-4 w-4" />
                              Restore
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {data?.pagination && data.pagination.last_page > 1 ? (
          <AdminPagination pagination={data.pagination} onPageChange={setPage} itemLabel="versions" />
        ) : null}
      </CardContent>

      <VersionDialog skill={skill} version={viewing} onClose={() => setViewing(null)} />

      <AlertDialog open={restoring !== null} onOpenChange={(open) => (open ? null : setRestoring(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore version {restoring?.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              {restoring ? restoreQuestion(restoring.version, skill.version) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                restore();
              }}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Restore as v{skill.version + 1}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** One version's steps against the current ones, line by line. */
function VersionDialog({
  skill,
  version,
  onClose,
}: {
  skill: AdminAiSkillDetail;
  version: number | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useAdminAiSkillVersion(skill.id, version);
  const shown = data?.data;
  const then = shown?.instructions;
  const now = skill.instructions;
  const lines = useMemo(() => (then !== undefined ? lineDiff(then, now) : []), [then, now]);
  const current = version === skill.version;

  return (
    <Dialog open={version !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Version {version}
            {current ? ' (current)' : ` → current v${skill.version}`}
          </DialogTitle>
          <DialogDescription>
            {shown
              ? `${shown.display_name} · ${LOAD_MODE_LABEL[shown.load_mode]} · ${current ? 'the steps as they are now' : diffSummary(lines)}`
              : 'Loading…'}
          </DialogDescription>
        </DialogHeader>
        {isLoading || !shown ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-lg border bg-muted/30 font-mono text-xs leading-relaxed">
            {shown.description !== skill.description && !current ? (
              <div className="border-b px-3 py-2 text-muted-foreground">
                Description then: <span className="text-foreground">{shown.description}</span>
              </div>
            ) : null}
            <ol aria-label="Steps, line by line">
              {lines.map((line, index) => (
                <li
                  key={index}
                  className={cn(
                    'whitespace-pre-wrap break-words px-3',
                    line.kind === 'added' && 'bg-primary/10',
                    line.kind === 'removed' && 'bg-destructive/10 text-muted-foreground line-through decoration-destructive/40',
                  )}
                >
                  <span aria-hidden className="mr-2 inline-block w-3 select-none text-muted-foreground">
                    {line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ' '}
                  </span>
                  <span className="sr-only">
                    {line.kind === 'added' ? 'Added: ' : line.kind === 'removed' ? 'Removed: ' : ''}
                  </span>
                  {line.text || ' '}
                </li>
              ))}
            </ol>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

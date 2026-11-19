'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { PrivateItemKind } from '@/types/private-items';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { shortDate } from './pages-model';
import { privateItemsQueries, useSkillMutations, useTemplateMutations } from './queries';
import { TemplateDocument } from './TemplateDocument';

/**
 * Version history (Arthur, 19 November 2026: in the first version). Every
 * replaced file, blank change or skill edit is a version. Pick one to read it;
 * "Restore this version" makes it the newest version again, so nothing is
 * lost by restoring.
 */
export function VersionHistory({
  kind,
  uuid,
  name,
  open,
  onClose,
}: {
  kind: PrivateItemKind;
  uuid: string;
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  const versions = useQuery({ ...privateItemsQueries.versions(kind, uuid), enabled: open });
  const rows = versions.data ?? [];
  const [picked, setPicked] = useState<number | null>(null);
  const current = rows[0]?.version ?? null;
  const shown = picked ?? current;
  const templates = useTemplateMutations();
  const skills = useSkillMutations();
  const restore = kind === 'template' ? templates.restore : skills.restore;

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      className="md:max-w-4xl"
      title="Version history"
      description={name}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            disabled={shown === null || shown === current || restore.isPending}
            onClick={() => {
              if (shown === null) return;
              restore.mutate(
                { uuid, version: shown },
                {
                  onSuccess: () => {
                    toast.success(`Version ${shown} restored. It is now the newest version.`);
                    onClose();
                  },
                  onError: (error) => toast.error(extractApiError(error).message),
                },
              );
            }}
          >
            {restore.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <History aria-hidden className="size-4" />}
            Restore this version
          </Button>
        </>
      }
    >
      {versions.isPending ? (
        <Skeleton aria-hidden className="h-80 rounded-xl" />
      ) : (
        <div className="grid gap-4 md:grid-cols-[15rem_1fr] md:items-start">
          <ol className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
            {rows.map((row) => (
              <li key={row.version} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setPicked(row.version)}
                  aria-current={shown === row.version}
                  className={cn(
                    'v2-interactive flex w-full flex-col rounded-xl border px-3 py-2 text-left transition-colors',
                    shown === row.version ? 'border-primary bg-accent/60' : 'border-border hover:bg-muted/60',
                  )}
                >
                  <span className="text-sm font-medium text-foreground">
                    Version {row.version}
                    {row.version === current ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">Current</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {shortDate(row.created_at)}
                    {row.by ? ` · ${row.by.name}` : ''}
                  </span>
                  {row.file ? <span className="truncate text-xs text-muted-foreground">{row.file.original_name}</span> : null}
                </button>
              </li>
            ))}
          </ol>
          {shown !== null ? <VersionBody kind={kind} uuid={uuid} version={shown} /> : null}
        </div>
      )}
    </ResponsiveOverlay>
  );
}

function VersionBody({ kind, uuid, version }: { kind: PrivateItemKind; uuid: string; version: number }) {
  const template = useQuery({ ...privateItemsQueries.templateVersion(uuid, version), enabled: kind === 'template' });
  const skill = useQuery({ ...privateItemsQueries.skillVersion(uuid, version), enabled: kind === 'skill' });
  if (kind === 'template') {
    if (!template.data) return <Skeleton aria-hidden className="h-80 rounded-xl" />;
    return <TemplateDocument segments={template.data.segments} className="max-h-[60vh] overflow-y-auto" />;
  }
  if (!skill.data) return <Skeleton aria-hidden className="h-80 rounded-xl" />;
  const s = skill.data;
  return (
    <dl className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-sm">
      <div>
        <dt className="text-xs font-medium text-muted-foreground">Name</dt>
        <dd className="text-foreground">{s.display_name}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium text-muted-foreground">When Lawexa uses it</dt>
        <dd className="text-foreground">{s.description}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium text-muted-foreground">Steps</dt>
        <dd className="whitespace-pre-wrap text-foreground">{s.instructions}</dd>
      </div>
      {s.example_output ? (
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Example of a good answer</dt>
          <dd className="whitespace-pre-wrap text-foreground">{s.example_output}</dd>
        </div>
      ) : null}
    </dl>
  );
}

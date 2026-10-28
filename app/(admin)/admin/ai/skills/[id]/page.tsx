'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, Calendar, FileText, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminAiSkill } from '@/lib/hooks/useAdminAi';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { AiSkillFormSheet } from '@/components/admin/ai/AiSkillFormSheet';
import { AiSkillDeleteDialog } from '@/components/admin/ai/AiSkillDeleteDialog';
import { AiSkillAgentManager } from '@/components/admin/ai/AiSkillAgentManager';
import { AiSkillVersions } from '@/components/admin/ai/AiSkillVersions';
import { AiSkillUsageCard } from '@/components/admin/ai/AiSkillUsageCard';
import { LOAD_MODE_LABEL, tokensLabel } from '@/components/admin/ai/skill-model';

/** One skill: its steps, the agents it is on, its versions and its use (a1f45096). */
export default function AiSkillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = use(params);
  const id = Number(idParam);
  const router = useRouter();
  const { data, isLoading, error } = useAdminAiSkill(id);
  const { setOverride, clearOverride } = useBreadcrumbStore();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (data?.data?.display_name) setOverride(idParam, data.data.display_name);
    return () => clearOverride(idParam);
  }, [data?.data?.display_name, idParam, setOverride, clearOverride]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="space-y-4">
        <Link href="/admin/ai/skills">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Skills
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Skill not found</CardContent>
        </Card>
      </div>
    );
  }

  const skill = data.data;

  return (
    <div className="space-y-6">
      <Link href="/admin/ai/skills">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Skills
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate">{skill.display_name}</CardTitle>
              <CardDescription className="mt-1 space-y-0.5">
                <span className="font-mono text-xs">{skill.name}</span>
                <span className="text-xs"> &middot; v{skill.version}</span>
                <p className="text-sm mt-1">{skill.description}</p>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={skill.is_active ? 'default' : 'secondary'}>{skill.is_active ? 'Active' : 'Inactive'}</Badge>
              <Badge variant="outline">{LOAD_MODE_LABEL[skill.load_mode]}</Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Skill actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setFormOpen(true)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">Cost of the steps</p>
              <p className="tabular-nums">{tokensLabel(skill.estimated_tokens)}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Loads (7 days)</p>
              <p className="tabular-nums">{skill.loads_7d.toLocaleString('en-US')}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Created
              </p>
              <p>
                {format(new Date(skill.created_at), 'PPp')}
                {skill.created_by ? <span className="text-muted-foreground"> · {skill.created_by.name}</span> : null}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Updated
              </p>
              <p>
                {format(new Date(skill.updated_at), 'PPp')}
                {skill.updated_by ? <span className="text-muted-foreground"> · {skill.updated_by.name}</span> : null}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Steps
          </CardTitle>
          <CardDescription>
            {skill.load_mode === 'on_demand'
              ? 'What Lawexa reads when it loads this skill.'
              : 'What goes into every turn of each agent this skill is on.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted rounded-lg p-4 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed max-h-[480px]">
            {skill.instructions}
          </pre>
        </CardContent>
      </Card>

      <AiSkillAgentManager skill={skill} />
      <AiSkillUsageCard skill={skill} />
      <AiSkillVersions skill={skill} />

      <AiSkillFormSheet open={formOpen} onOpenChange={setFormOpen} skill={skill} />
      <AiSkillDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        skill={skill}
        onDeleted={() => router.push('/admin/ai/skills')}
      />
    </div>
  );
}

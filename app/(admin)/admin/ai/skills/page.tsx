'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import { AiSkillFilters } from '@/components/admin/ai/AiSkillFilters';
import { AiSkillsTable } from '@/components/admin/ai/AiSkillsTable';
import { AiSkillFormSheet } from '@/components/admin/ai/AiSkillFormSheet';
import { AiSkillDeleteDialog } from '@/components/admin/ai/AiSkillDeleteDialog';
import { useAdminAiSkills } from '@/lib/hooks/useAdminAi';
import type { AdminAiSkill, AdminAiSkillsParams } from '@/types/admin-ai';

/** Admin › AI › Skills: the list beside Tools (a1f45096, 28 October 2026). */
function AiSkillsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<AdminAiSkill | null>(null);
  const [deletingSkill, setDeletingSkill] = useState<AdminAiSkill | null>(null);

  const params = useMemo<AdminAiSkillsParams>(() => {
    const loadMode = searchParams.get('load_mode');
    const isActive = searchParams.get('is_active');
    return {
      page: Number(searchParams.get('page')) || 1,
      per_page: Number(searchParams.get('per_page')) || 15,
      search: searchParams.get('search') || undefined,
      load_mode: loadMode === 'on_demand' || loadMode === 'always_on' ? loadMode : undefined,
      is_active: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    };
  }, [searchParams]);

  const { data, isLoading } = useAdminAiSkills(params);

  const updateParams = useCallback(
    (updates: Partial<AdminAiSkillsParams>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      });
      const query = next.toString();
      router.push(query ? `/admin/ai/skills?${query}` : '/admin/ai/skills');
    },
    [router, searchParams],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>AI Skills</CardTitle>
            <CardDescription className="mt-1.5">
              Named steps for one kind of task. Lawexa sees an on-demand skill as one line and loads it when needed; an
              always-on skill goes into every turn.
            </CardDescription>
          </div>
          <Button
            onClick={() => {
              setEditingSkill(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Skill
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <AiSkillFilters params={params} onParamsChange={updateParams} />
          <AiSkillsTable
            skills={data?.data || []}
            isLoading={isLoading}
            onEdit={(skill) => {
              setEditingSkill(skill);
              setFormOpen(true);
            }}
            onDelete={setDeletingSkill}
          />
          {data?.pagination && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={(page) => updateParams({ page })}
              itemLabel="skills"
            />
          )}
        </CardContent>
      </Card>

      <AiSkillFormSheet open={formOpen} onOpenChange={setFormOpen} skill={editingSkill} />
      <AiSkillDeleteDialog
        open={deletingSkill !== null}
        onOpenChange={(open) => (open ? null : setDeletingSkill(null))}
        skill={deletingSkill}
      />
    </div>
  );
}

export default function AiSkillsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>AI Skills</CardTitle>
              <Skeleton className="h-10 w-[120px]" />
            </CardHeader>
            <CardContent className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      }
    >
      <AiSkillsPageContent />
    </Suspense>
  );
}

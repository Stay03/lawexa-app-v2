'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPagination } from '@/components/admin';
import { AiAgentFilters } from '@/components/admin/ai/AiAgentFilters';
import { AiAgentsTable } from '@/components/admin/ai/AiAgentsTable';
import { AiAgentFormSheet } from '@/components/admin/ai/AiAgentFormSheet';
import { AiAgentDeleteDialog } from '@/components/admin/ai/AiAgentDeleteDialog';
import { AiAgentCopyDialog } from '@/components/admin/ai/AiAgentCopyDialog';
import { useAdminAiAgents } from '@/lib/hooks/useAdminAi';
import type { AdminAiAgentsParams, AdminAiAgent } from '@/types/admin-ai';

type AgentSortField = 'name' | 'created_at' | 'temperature';

function AiAgentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Dialog state - Sheet only used for creating new agents
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState<AdminAiAgent | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyingAgent, setCopyingAgent] = useState<AdminAiAgent | null>(null);

  // Read params from URL
  const params = useMemo<AdminAiAgentsParams>(() => {
    const page = Number(searchParams.get('page')) || 1;
    const per_page = Number(searchParams.get('per_page')) || 15;
    const sort_by = (searchParams.get('sort_by') as AdminAiAgentsParams['sort_by']) || 'name';
    const sort_order = (searchParams.get('sort_order') as AdminAiAgentsParams['sort_order']) || 'asc';
    const model_id = searchParams.get('model_id');
    const active_only = searchParams.get('active_only');

    return {
      page,
      per_page,
      sort_by,
      sort_order,
      model_id: model_id ? Number(model_id) : undefined,
      active_only: active_only === null ? undefined : active_only === 'true',
    };
  }, [searchParams]);

  const { data, isLoading } = useAdminAiAgents(params);

  // Update URL params
  const updateParams = useCallback(
    (updates: Partial<AdminAiAgentsParams>) => {
      const newParams = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
      });

      const queryString = newParams.toString();
      router.push(
        queryString
          ? `/admin/ai/agents?${queryString}`
          : '/admin/ai/agents'
      );
    },
    [router, searchParams]
  );

  const handleParamsChange = useCallback(
    (newParams: Partial<AdminAiAgentsParams>) => {
      updateParams(newParams);
    },
    [updateParams]
  );

  const handleSort = useCallback(
    (sortBy: AgentSortField) => {
      updateParams({
        sort_by: sortBy,
        sort_order:
          params.sort_by === sortBy && params.sort_order === 'asc'
            ? 'desc'
            : 'asc',
      });
    },
    [updateParams, params.sort_by, params.sort_order]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      updateParams({ page });
    },
    [updateParams]
  );

  const handleCopy = useCallback((agent: AdminAiAgent) => {
    setCopyingAgent(agent);
    setCopyOpen(true);
  }, []);

  const handleDelete = useCallback((agent: AdminAiAgent) => {
    setDeletingAgent(agent);
    setDeleteOpen(true);
  }, []);

  const handleAddAgent = useCallback(() => {
    setFormOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>AI Agents</CardTitle>
          <Button onClick={handleAddAgent}>
            <Plus className="mr-2 h-4 w-4" />
            Add Agent
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <AiAgentFilters
            params={params}
            onParamsChange={handleParamsChange}
          />

          <AiAgentsTable
            agents={data?.data || []}
            isLoading={isLoading}
            params={params}
            onSort={handleSort}
            onCopy={handleCopy}
            onDelete={handleDelete}
          />

          {data?.pagination && (
            <AdminPagination
              pagination={data.pagination}
              onPageChange={handlePageChange}
              itemLabel="agents"
            />
          )}
        </CardContent>
      </Card>

      <AiAgentFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <AiAgentDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        agent={deletingAgent}
      />

      <AiAgentCopyDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        agent={copyingAgent}
      />
    </div>
  );
}

export default function AiAgentsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>AI Agents</CardTitle>
              <Skeleton className="h-10 w-[120px]" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Skeleton className="h-10 w-[200px]" />
                <Skeleton className="h-10 w-[130px]" />
                <Skeleton className="h-10 w-[100px]" />
              </div>
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <AiAgentsPageContent />
    </Suspense>
  );
}

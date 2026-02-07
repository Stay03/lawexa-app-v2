'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  ArrowLeft,
  Calendar,
  MoreHorizontal,
  Pencil,
  Trash2,
  Star,
  Bot,
  GitBranch,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

import { useAdminAiWorkflow } from '@/lib/hooks/useAdminAi';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { AiWorkflowDeleteDialog } from '@/components/admin/ai/AiWorkflowDeleteDialog';
import type { WorkflowAgentRole } from '@/types/admin-ai';

interface AiWorkflowDetailPageProps {
  params: Promise<{ id: string }>;
}

function getRoleBadgeVariant(role: WorkflowAgentRole): 'default' | 'outline' | 'secondary' {
  switch (role) {
    case 'primary':
      return 'default';
    case 'specialist':
      return 'outline';
    case 'fallback':
      return 'secondary';
    default:
      return 'outline';
  }
}

export default function AiWorkflowDetailPage({
  params,
}: AiWorkflowDetailPageProps) {
  const { id: idParam } = use(params);
  const id = Number(idParam);
  const router = useRouter();
  const { data, isLoading, error } = useAdminAiWorkflow(id);
  const { setOverride, clearOverride } = useBreadcrumbStore();

  const [deleteOpen, setDeleteOpen] = useState(false);

  // Set breadcrumb label to workflow name
  useEffect(() => {
    if (data?.data?.name) {
      setOverride(idParam, data.data.name);
    }
    return () => {
      clearOverride(idParam);
    };
  }, [data?.data?.name, idParam, setOverride, clearOverride]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="space-y-4">
        <Link href="/admin/ai/workflows">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workflows
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Workflow not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const workflow = data.data;
  const sortedAgents = [...workflow.agents].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/admin/ai/workflows">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Workflows
        </Button>
      </Link>

      {/* Workflow Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate">{workflow.name}</CardTitle>
              <CardDescription className="mt-1 space-y-0.5">
                <span className="font-mono text-xs">{workflow.slug}</span>
                <span className="text-xs"> &middot; ID: {workflow.id}</span>
                {workflow.description && (
                  <p className="text-sm mt-1">{workflow.description}</p>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={workflow.is_active ? 'default' : 'secondary'}>
                {workflow.is_active ? 'Active' : 'Inactive'}
              </Badge>
              {workflow.is_default && (
                <Badge variant="outline" className="gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  Default
                </Badge>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/ai/workflows/${workflow.id}/edit`}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
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
              <p className="text-muted-foreground mb-1">Execution Mode</p>
              <Badge variant={workflow.execution_mode === 'react' ? 'default' : 'outline'}>
                {workflow.execution_mode === 'react' ? 'ReAct' : 'Simple'}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Is Default</p>
              <div className="flex items-center gap-1.5">
                <Star
                  className={cn(
                    'h-4 w-4',
                    workflow.is_default
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-muted-foreground'
                  )}
                />
                <span>{workflow.is_default ? 'Yes' : 'No'}</span>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Conversations</p>
              <p className="tabular-nums">{workflow.conversations_count ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Created
              </p>
              <p>{format(new Date(workflow.created_at), 'PPp')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4">
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Updated
              </p>
              <p>{format(new Date(workflow.updated_at), 'PPp')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orchestrator Agent Card */}
      {workflow.orchestrator_agent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Orchestrator Agent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Link
                  href={`/admin/ai/agents/${workflow.orchestrator_agent.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {workflow.orchestrator_agent.name}
                </Link>
                {workflow.orchestrator_agent.model && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Model:{' '}
                    <Link
                      href={`/admin/ai/models/${workflow.orchestrator_agent.model.id}`}
                      className="text-primary hover:underline"
                    >
                      {workflow.orchestrator_agent.model.name}
                    </Link>
                  </p>
                )}
              </div>
              <Badge
                variant={
                  workflow.orchestrator_agent.is_active ? 'default' : 'secondary'
                }
              >
                {workflow.orchestrator_agent.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflow Agents Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Agents ({workflow.agents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No agents assigned to this workflow.
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[70px] font-semibold">Order</TableHead>
                    <TableHead className="font-semibold">Agent Name</TableHead>
                    <TableHead className="w-[110px] font-semibold">Role</TableHead>
                    <TableHead className="font-semibold">Model</TableHead>
                    <TableHead className="w-[80px] font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAgents.map((agent, index) => (
                    <TableRow
                      key={`${agent.id}-${index}`}
                      className={cn(index % 2 === 1 && 'bg-muted/20')}
                    >
                      <TableCell className="tabular-nums text-muted-foreground">
                        {agent.order}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          href={`/admin/ai/agents/${agent.id}`}
                          className="text-primary hover:underline"
                        >
                          {agent.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(agent.role)}>
                          {agent.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {agent.model ? (
                          <Link
                            href={`/admin/ai/models/${agent.model.id}`}
                            className="text-sm text-primary hover:underline"
                          >
                            {agent.model.name}
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={agent.is_active ? 'default' : 'secondary'}>
                          {agent.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <AiWorkflowDeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open && !data?.data) {
            router.push('/admin/ai/workflows');
          }
        }}
        workflow={workflow}
      />
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, X, Plus } from 'lucide-react';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

import {
  useAdminAiAgents,
  useAttachToolToAgent,
  useDetachToolFromAgent,
} from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminAiToolDetail } from '@/types/admin-ai';

interface AiToolAgentManagerProps {
  tool: AdminAiToolDetail;
}

export function AiToolAgentManager({ tool }: AiToolAgentManagerProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [detachingAgentId, setDetachingAgentId] = useState<number | null>(null);

  const { data: agentsData } = useAdminAiAgents({ per_page: 100, active_only: true });
  const attachMutation = useAttachToolToAgent();
  const detachMutation = useDetachToolFromAgent();

  // Filter out already-attached agents
  const assignedAgentIds = new Set(tool.agents.map((a) => a.id));
  const availableAgents = (agentsData?.data || []).filter(
    (a) => !assignedAgentIds.has(a.id)
  );

  const handleAttach = () => {
    if (!selectedAgentId) return;
    const agentId = Number(selectedAgentId);

    attachMutation.mutate(
      { toolId: tool.id, agentId },
      {
        onSuccess: (response) => {
          toast.success(response.message || 'Agent attached successfully');
          setSelectedAgentId('');
        },
        onError: (error) => {
          const apiError = extractApiError(error);
          toast.error(apiError.message);
        },
      }
    );
  };

  const handleDetach = (agentId: number) => {
    setDetachingAgentId(agentId);

    detachMutation.mutate(
      { toolId: tool.id, agentId },
      {
        onSuccess: (response) => {
          toast.success(response.message || 'Agent detached successfully');
          setDetachingAgentId(null);
        },
        onError: (error) => {
          const apiError = extractApiError(error);
          toast.error(apiError.message);
          setDetachingAgentId(null);
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Assigned Agents ({tool.agents.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Currently assigned agents */}
        {tool.agents.length > 0 ? (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold">Agent Name</TableHead>
                  <TableHead className="font-semibold">Slug</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tool.agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <Link
                        href={`/admin/ai/agents/${agent.id}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {agent.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {agent.slug}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={agent.is_active ? 'default' : 'secondary'}>
                        {agent.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDetach(agent.id)}
                        disabled={detachMutation.isPending && detachingAgentId === agent.id}
                      >
                        {detachMutation.isPending && detachingAgentId === agent.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No agents assigned to this tool.
          </p>
        )}

        <Separator />

        {/* Attach new agent */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium mb-2">Attach Agent</p>
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent to attach..." />
              </SelectTrigger>
              <SelectContent>
                {availableAgents.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No available agents
                  </SelectItem>
                ) : (
                  availableAgents.map((agent) => (
                    <SelectItem key={agent.id} value={String(agent.id)}>
                      {agent.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleAttach}
            disabled={!selectedAgentId || selectedAgentId === '__none__' || attachMutation.isPending}
          >
            {attachMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Attach
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

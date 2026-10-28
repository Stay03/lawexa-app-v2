'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, X, Plus } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useAdminAiAgents, useAttachSkillToAgent, useDetachSkillFromAgent } from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminAiSkillDetail } from '@/types/admin-ai';
import { alwaysOnCostNote } from './skill-model';

/**
 * The agents a skill is on, with attach and detach, as on a tool. A skill
 * reaches Lawexa only through an agent; an always-on one costs its steps on
 * every turn of each agent it is on, so that is said beside each.
 */
export function AiSkillAgentManager({ skill }: { skill: AdminAiSkillDetail }) {
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [detachingAgentId, setDetachingAgentId] = useState<number | null>(null);
  const { data: agentsData } = useAdminAiAgents({ per_page: 100, active_only: true });
  const attachMutation = useAttachSkillToAgent();
  const detachMutation = useDetachSkillFromAgent();

  const attachedIds = new Set(skill.agents.map((agent) => agent.id));
  const availableAgents = (agentsData?.data || []).filter((agent) => !attachedIds.has(agent.id));
  const alwaysOn = skill.load_mode === 'always_on';

  const handleAttach = () => {
    if (!selectedAgentId) return;
    attachMutation.mutate(
      { skillId: skill.id, agentId: Number(selectedAgentId) },
      {
        onSuccess: (response) => {
          toast.success(response.message || 'Skill attached');
          setSelectedAgentId('');
        },
        onError: (error) => toast.error(extractApiError(error).message),
      },
    );
  };

  const handleDetach = (agentId: number) => {
    setDetachingAgentId(agentId);
    detachMutation.mutate(
      { skillId: skill.id, agentId },
      {
        onSuccess: (response) => toast.success(response.message || 'Skill detached'),
        onError: (error) => toast.error(extractApiError(error).message),
        onSettled: () => setDetachingAgentId(null),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Agents ({skill.agents.length})</CardTitle>
        <CardDescription>
          {alwaysOn
            ? 'Always on: the steps go into every turn of these agents.'
            : 'On demand: these agents see the description and can load the steps.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {skill.agents.length > 0 ? (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-semibold">Agent</TableHead>
                  <TableHead className="font-semibold">Slug</TableHead>
                  {alwaysOn ? <TableHead className="font-semibold">Cost</TableHead> : null}
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {skill.agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <Link href={`/admin/ai/agents/${agent.id}`} className="text-primary hover:underline font-medium">
                        {agent.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{agent.slug}</span>
                    </TableCell>
                    {alwaysOn ? (
                      <TableCell className="text-sm text-muted-foreground">
                        {alwaysOnCostNote(skill.estimated_tokens)}
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label={`Detach from ${agent.name}`}
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
          <p className="text-sm text-muted-foreground">On no agent yet, so Lawexa never sees it.</p>
        )}

        <Separator />

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium mb-2">Attach to an agent</p>
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger aria-label="Agent to attach">
                <SelectValue placeholder="Select an agent…" />
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
            {attachMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Attach
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Network, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminAiAgents, useUpdateAiAgent } from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminAiAgentDetail } from '@/types/admin-ai';
import { addableAgents, calleeLabel, idsWith, idsWithout } from './agent-can-call-model';

/**
 * AiAgentCanCallCard — the agents this agent may message with
 * `message_agent` (sub-agents contract, section 5.1): "Can call". Add an
 * active agent from the list, or remove one; each change saves the whole
 * list, as the server replaces it. Listing the agent itself lets it call
 * "lawexa", a fresh copy of itself.
 *
 * Whether the agent is offered `message_agent` at all is the tool's own
 * attachment (Tools); an agent with the tool and an empty list can message
 * no one. Nothing is drawn for a server that sends no `can_call`.
 */
export function AiAgentCanCallCard({ agent }: { agent: AdminAiAgentDetail }) {
  const listed = agent.can_call;
  const [choice, setChoice] = useState('');
  const [removing, setRemoving] = useState<number | null>(null);
  const { data: agentsData, isPending: agentsLoading } = useAdminAiAgents({ per_page: 100, active_only: true });
  const update = useUpdateAiAgent();

  if (!listed) return null;
  const addable = addableAgents(agentsData?.data ?? [], listed, agent.id);

  const save = (ids: number[], done: string, after: () => void) => {
    update.mutate(
      { id: agent.id, data: { can_call_agent_ids: ids } },
      {
        onSuccess: () => {
          toast.success(done);
          after();
        },
        onError: (error) => {
          toast.error(extractApiError(error).message);
          after();
        },
      },
    );
  };

  const add = () => {
    if (!choice) return;
    const added = addable.find((candidate) => candidate.id === Number(choice));
    save(idsWith(listed, Number(choice)), `${agent.name} can now call ${added?.name ?? 'that agent'}.`, () => setChoice(''));
  };

  const remove = (id: number, name: string) => {
    setRemoving(id);
    save(idsWithout(listed, id), `${agent.name} can no longer call ${name}.`, () => setRemoving(null));
  };

  const adding = update.isPending && removing === null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Network className="h-4 w-4" />
          Can call ({listed.length})
        </CardTitle>
        <CardDescription>
          The agents {agent.name} may message with message_agent. Add {agent.name} itself to let it call &quot;lawexa&quot;, a
          fresh copy of itself. It needs the message_agent tool too (
          <Link href="/admin/ai/tools" className="text-primary hover:underline">
            Tools
          </Link>
          ).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {listed.length === 0 ? (
          <p className="text-sm text-muted-foreground">{agent.name} can call no other agent.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {listed.map((callee) => (
              <li key={callee.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <Link href={`/admin/ai/agents/${callee.id}`} className="block truncate font-medium text-primary hover:underline">
                    {calleeLabel(callee, agent.id)}
                  </Link>
                  <span className="block truncate font-mono text-xs text-muted-foreground">{callee.slug}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {callee.is_active ? null : <Badge variant="secondary">Inactive</Badge>}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={update.isPending}
                    onClick={() => remove(callee.id, callee.name)}
                    aria-label={`Remove ${callee.name} from the agents ${agent.name} can call`}
                  >
                    {removing === callee.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2">
          <Select value={choice} onValueChange={setChoice} disabled={agentsLoading || addable.length === 0 || update.isPending}>
            <SelectTrigger className="flex-1" aria-label="An agent to add">
              <SelectValue
                placeholder={agentsLoading ? 'Loading agents…' : addable.length === 0 ? 'Every active agent is listed' : 'Add an agent'}
              />
            </SelectTrigger>
            <SelectContent>
              {addable.map((candidate) => (
                <SelectItem key={candidate.id} value={String(candidate.id)}>
                  {calleeLabel(candidate, agent.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={add} disabled={!choice || update.isPending}>
            {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

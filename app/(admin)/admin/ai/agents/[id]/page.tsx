'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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
  Thermometer,
  Hash,
  Repeat,
  MessageSquare,
  Server,
  DollarSign,
  Bot,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';

import { useAdminAiAgent } from '@/lib/hooks/useAdminAi';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { AiAgentDeleteDialog } from '@/components/admin/ai/AiAgentDeleteDialog';
import type { AdminAiAgent } from '@/types/admin-ai';

interface AiAgentDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatContextTokens(tokens: number | null | undefined): string {
  if (!tokens) return '-';
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(tokens % 1_000 === 0 ? 0 : 1)}K`;
  return tokens.toLocaleString();
}

export default function AiAgentDetailPage({
  params,
}: AiAgentDetailPageProps) {
  const { id: idParam } = use(params);
  const id = Number(idParam);
  const router = useRouter();
  const { data, isLoading, error } = useAdminAiAgent(id);
  const { setOverride, clearOverride } = useBreadcrumbStore();

  const [deleteOpen, setDeleteOpen] = useState(false);

  // Set breadcrumb label to agent name
  useEffect(() => {
    if (data?.data?.name) {
      setOverride(idParam, data.data.name);
    }
    return () => {
      clearOverride(idParam);
    };
  }, [data?.data?.name, idParam, setOverride, clearOverride]);

  const agentForDialogs: AdminAiAgent | null = data?.data || null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="space-y-4">
        <Link href="/admin/ai/agents">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Agents
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Agent not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const agent = data.data;
  const model = agent.model;
  const provider = model?.provider;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/admin/ai/agents">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Agents
        </Button>
      </Link>

      {/* Agent Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate">{agent.name}</CardTitle>
              <CardDescription className="mt-1 space-y-0.5">
                <span className="font-mono text-xs">{agent.slug}</span>
                <span className="text-xs"> &middot; ID: {agent.id}</span>
                {agent.description && (
                  <p className="text-sm mt-1">{agent.description}</p>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={agent.is_active ? 'default' : 'secondary'}>
                {agent.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/admin/ai/agents/${agent.id}/edit`}>
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
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Thermometer className="h-3 w-3" /> Temperature
              </p>
              <p className="font-mono tabular-nums">{agent.temperature}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Hash className="h-3 w-3" /> Max Response Tokens
              </p>
              <p className="tabular-nums">{agent.max_response_tokens.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Repeat className="h-3 w-3" /> Max Iterations
              </p>
              <p className="tabular-nums">{agent.max_iterations ?? 'Default'}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> Conversations
              </p>
              <p className="tabular-nums">{agent.conversations_count ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Created
              </p>
              <p>{format(new Date(agent.created_at), 'PPp')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4">
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Updated
              </p>
              <p>{format(new Date(agent.updated_at), 'PPp')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Model & Provider Card */}
      {model && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Model & Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <p className="text-muted-foreground text-sm mb-1 flex items-center gap-1">
                    <Bot className="h-3 w-3" /> Model
                  </p>
                  <Link
                    href={`/admin/ai/models/${model.id}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {model.name}
                  </Link>
                  <p className="font-mono text-xs text-muted-foreground mt-0.5">
                    {model.model_id}
                  </p>
                </div>
                {provider && (
                  <div>
                    <p className="text-muted-foreground text-sm mb-1 flex items-center gap-1">
                      <Server className="h-3 w-3" /> Provider
                    </p>
                    <Link
                      href={`/admin/ai/providers/${provider.id}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {provider.name}
                    </Link>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1 flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Input $/1M
                    </p>
                    <p className="font-mono tabular-nums">${model.input_price_per_1m}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1 flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Output $/1M
                    </p>
                    <p className="font-mono tabular-nums">${model.output_price_per_1m}</p>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm mb-1 flex items-center gap-1">
                    <Hash className="h-3 w-3" /> Context Window
                  </p>
                  <p className="tabular-nums">
                    {formatContextTokens(model.max_context_tokens)}
                    {model.max_context_tokens && (
                      <span className="text-muted-foreground ml-1 text-xs">
                        ({model.max_context_tokens.toLocaleString()} tokens)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Prompt Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-4 w-4" />
              System Prompt
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/ai/agents/${agent.id}/edit`}>
                <Pencil className="mr-2 h-3 w-3" />
                Edit
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {agent.system_prompt ? (
            <div className="prose prose-sm dark:prose-invert max-w-none [&_code]:bg-muted [&_pre]:bg-muted [&_pre]:overflow-x-auto rounded-lg border bg-muted/30 p-4">
              <ReactMarkdown remarkPlugins={[remarkBreaks, remarkGfm]}>
                {agent.system_prompt}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No system prompt configured.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <AiAgentDeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open && !agentForDialogs) {
            router.push('/admin/ai/agents');
          }
        }}
        agent={agentForDialogs}
      />
    </div>
  );
}

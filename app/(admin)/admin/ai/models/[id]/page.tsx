'use client';

import { use, useEffect, useState, useCallback } from 'react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Calendar,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  DollarSign,
  Hash,
  Server,
} from 'lucide-react';
import { format } from 'date-fns';

import { useAdminAiModel } from '@/lib/hooks/useAdminAi';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { AiModelFormSheet } from '@/components/admin/ai/AiModelFormSheet';
import { AiModelDeleteDialog } from '@/components/admin/ai/AiModelDeleteDialog';
import type { AdminAiModel } from '@/types/admin-ai';

interface AiModelDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatContextTokens(tokens: number | null | undefined): string {
  if (!tokens) return '-';
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(tokens % 1_000 === 0 ? 0 : 1)}K`;
  return tokens.toLocaleString();
}

export default function AiModelDetailPage({
  params,
}: AiModelDetailPageProps) {
  const { id: idParam } = use(params);
  const id = Number(idParam);
  const router = useRouter();
  const { data, isLoading, error } = useAdminAiModel(id);
  const { setOverride, clearOverride } = useBreadcrumbStore();

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Set breadcrumb label to model name
  useEffect(() => {
    if (data?.data?.name) {
      setOverride(idParam, data.data.name);
    }
    return () => {
      clearOverride(idParam);
    };
  }, [data?.data?.name, idParam, setOverride, clearOverride]);

  // Build a simplified AdminAiModel for dialog props
  const modelForDialogs: AdminAiModel | null = data?.data || null;

  const handleDeleteSuccess = useCallback(() => {
    setDeleteOpen(false);
    router.push('/admin/ai/models');
  }, [router]);

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
        <Link href="/admin/ai/models">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Models
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Model not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const model = data.data;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/admin/ai/models">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Models
        </Button>
      </Link>

      {/* Model Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate">{model.name}</CardTitle>
              <CardDescription className="font-mono text-xs mt-1">
                {model.model_id} &middot; ID: {model.id}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setFormOpen(true)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
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
                <Server className="h-3 w-3" /> Provider
              </p>
              {model.provider ? (
                <Link
                  href={`/admin/ai/providers/${model.provider.id}`}
                  className="text-primary hover:underline font-medium"
                >
                  {model.provider.name}
                </Link>
              ) : (
                <p className="text-muted-foreground">-</p>
              )}
            </div>
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
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4">
            <div>
              <p className="text-muted-foreground mb-1">Vision</p>
              <div className="flex items-center gap-1.5">
                {model.supports_vision ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Supported</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Not supported</span>
                  </>
                )}
              </div>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Streaming</p>
              <div className="flex items-center gap-1.5">
                {model.supports_streaming ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Supported</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Not supported</span>
                  </>
                )}
              </div>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Created
              </p>
              <p>{format(new Date(model.created_at), 'PPp')}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Updated
              </p>
              <p>{format(new Date(model.updated_at), 'PPp')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider Card */}
      {model.provider && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{model.provider.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {model.provider.slug}
                </p>
              </div>
              <Link href={`/admin/ai/providers/${model.provider.id}`}>
                <Button variant="outline" size="sm">
                  View Provider
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Provider Routing Card (OpenRouter only) */}
      {(() => {
        const routing = model.provider_routing;
        if (!routing) return null;
        const hasOrder = Array.isArray(routing.order) && routing.order.length > 0;
        const hasAllowFallbacks =
          routing.allow_fallbacks !== undefined && routing.allow_fallbacks !== null;
        if (!hasOrder && !hasAllowFallbacks) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Provider Routing</CardTitle>
              <CardDescription className="text-xs">
                Maps to OpenRouter&apos;s{' '}
                <code className="font-mono">provider</code> parameter.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-2">Preferred order</p>
                {hasOrder ? (
                  <ol className="space-y-1.5">
                    {routing.order!.map((slug, index) => (
                      <li
                        key={`${slug}-${index}`}
                        className="flex items-center gap-2"
                      >
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs tabular-nums text-muted-foreground">
                          {index + 1}
                        </span>
                        <span className="font-mono">{slug}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-muted-foreground">—</p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Allow fallbacks</p>
                {hasAllowFallbacks ? (
                  <div className="flex items-center gap-1.5">
                    {routing.allow_fallbacks ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Yes</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">No</span>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">—</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Dialogs */}
      <AiModelFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        model={modelForDialogs}
      />

      <AiModelDeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open && !modelForDialogs) {
            router.push('/admin/ai/models');
          }
        }}
        model={modelForDialogs}
      />
    </div>
  );
}

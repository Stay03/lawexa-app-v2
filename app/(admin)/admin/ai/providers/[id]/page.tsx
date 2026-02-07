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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Calendar,
  Box,
  Globe,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

import { useAdminAiProvider } from '@/lib/hooks/useAdminAi';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { AiProviderTestButton } from '@/components/admin/ai/AiProviderTestButton';
import { AiProviderFormDialog } from '@/components/admin/ai/AiProviderFormDialog';
import { AiProviderDeleteDialog } from '@/components/admin/ai/AiProviderDeleteDialog';
import type { AdminAiProvider } from '@/types/admin-ai';

interface AiProviderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function AiProviderDetailPage({
  params,
}: AiProviderDetailPageProps) {
  const { id: idParam } = use(params);
  const id = Number(idParam);
  const router = useRouter();
  const { data, isLoading, error } = useAdminAiProvider(id);
  const { setOverride, clearOverride } = useBreadcrumbStore();

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Set breadcrumb label to provider name
  useEffect(() => {
    if (data?.data?.name) {
      setOverride(idParam, data.data.name);
    }
    return () => {
      clearOverride(idParam);
    };
  }, [data?.data?.name, idParam, setOverride, clearOverride]);

  // Build a simplified AdminAiProvider for dialog props
  const providerForDialogs: AdminAiProvider | null = data?.data
    ? {
        id: data.data.id,
        name: data.data.name,
        slug: data.data.slug,
        base_url: data.data.base_url,
        is_active: data.data.is_active,
        models_count: data.data.models_count,
        created_at: data.data.created_at,
        updated_at: data.data.updated_at,
      }
    : null;

  const handleDeleteSuccess = useCallback(() => {
    setDeleteOpen(false);
    router.push('/admin/ai/providers');
  }, [router]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="space-y-4">
        <Link href="/admin/ai/providers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Providers
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Provider not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const provider = data.data;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/admin/ai/providers">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Providers
        </Button>
      </Link>

      {/* Provider Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate">{provider.name}</CardTitle>
              <CardDescription className="font-mono text-xs mt-1">
                {provider.slug} &middot; ID: {provider.id}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant={provider.is_active ? 'default' : 'secondary'}
              >
                {provider.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <AiProviderTestButton providerId={provider.id} />
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
                <Globe className="h-3 w-3" /> Base URL
              </p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="font-mono text-xs truncate cursor-help">
                    {provider.base_url}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-mono text-xs">{provider.base_url}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Box className="h-3 w-3" /> Models
              </p>
              <p className="tabular-nums">{provider.models_count}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Created
              </p>
              <p>{format(new Date(provider.created_at), 'PPp')}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Updated
              </p>
              <p>{format(new Date(provider.updated_at), 'PPp')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Models Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Models ({provider.models?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!provider.models || provider.models.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No models configured for this provider
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Model ID</TableHead>
                    <TableHead className="text-right font-semibold">
                      Input $/1M
                    </TableHead>
                    <TableHead className="text-right font-semibold">
                      Output $/1M
                    </TableHead>
                    <TableHead className="text-right font-semibold">
                      Context
                    </TableHead>
                    <TableHead className="text-center font-semibold">
                      Vision
                    </TableHead>
                    <TableHead className="text-center font-semibold">
                      Streaming
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {provider.models.map((model, index) => (
                    <TableRow
                      key={model.id}
                      className={cn(
                        'cursor-pointer transition-colors',
                        index % 2 === 1 && 'bg-muted/20'
                      )}
                      onClick={() =>
                        router.push(`/admin/ai/models/${model.id}`)
                      }
                    >
                      <TableCell className="font-medium">
                        {model.name}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {model.model_id}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        ${model.input_price_per_1m}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        ${model.output_price_per_1m}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {model.max_context_tokens?.toLocaleString() || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {model.supports_vision ? (
                          <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {model.supports_streaming ? (
                          <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AiProviderFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        provider={providerForDialogs}
      />

      <AiProviderDeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open && !providerForDialogs) {
            router.push('/admin/ai/providers');
          }
        }}
        provider={providerForDialogs}
      />
    </div>
  );
}

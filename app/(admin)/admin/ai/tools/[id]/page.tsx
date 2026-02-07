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
  CheckCircle,
  XCircle,
  Code,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

import { useAdminAiTool } from '@/lib/hooks/useAdminAi';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { AiToolFormSheet } from '@/components/admin/ai/AiToolFormSheet';
import { AiToolDeleteDialog } from '@/components/admin/ai/AiToolDeleteDialog';
import { AiToolAgentManager } from '@/components/admin/ai/AiToolAgentManager';
import type { AdminAiTool } from '@/types/admin-ai';

interface AiToolDetailPageProps {
  params: Promise<{ id: string }>;
}

function getHttpMethodBadge(method: string) {
  const colors: Record<string, string> = {
    GET: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    POST: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    PUT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    PATCH: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <Badge variant="outline" className={cn('font-mono text-xs', colors[method] || '')}>
      {method}
    </Badge>
  );
}

export default function AiToolDetailPage({
  params,
}: AiToolDetailPageProps) {
  const { id: idParam } = use(params);
  const id = Number(idParam);
  const router = useRouter();
  const { data, isLoading, error } = useAdminAiTool(id);
  const { setOverride, clearOverride } = useBreadcrumbStore();

  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Set breadcrumb label to tool display name
  useEffect(() => {
    if (data?.data?.display_name) {
      setOverride(idParam, data.data.display_name);
    }
    return () => {
      clearOverride(idParam);
    };
  }, [data?.data?.display_name, idParam, setOverride, clearOverride]);

  const toolForDialogs: AdminAiTool | null = data?.data || null;

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
        <Link href="/admin/ai/tools">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tools
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Tool not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const tool = data.data;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/admin/ai/tools">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tools
        </Button>
      </Link>

      {/* Tool Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate">{tool.display_name}</CardTitle>
              <CardDescription className="mt-1 space-y-0.5">
                <span className="font-mono text-xs">{tool.name}</span>
                <span className="text-xs"> &middot; ID: {tool.id}</span>
                {tool.description && (
                  <p className="text-sm mt-1">{tool.description}</p>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={tool.is_active ? 'default' : 'secondary'}>
                {tool.is_active ? 'Active' : 'Inactive'}
              </Badge>
              {tool.category && (
                <Badge variant="outline">{tool.category}</Badge>
              )}
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
              <p className="text-muted-foreground mb-1">HTTP Method</p>
              {getHttpMethodBadge(tool.http_method)}
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Endpoint URL</p>
              <p className="font-mono text-xs break-all">{tool.endpoint_url}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Timeout</p>
              <p className="tabular-nums">{tool.timeout_seconds}s</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Retry Count</p>
              <p className="tabular-nums">{tool.retry_count}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4">
            <div>
              <p className="text-muted-foreground mb-1">Auth Required</p>
              <div className="flex items-center gap-1.5">
                {tool.requires_auth ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Required</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Not required</span>
                  </>
                )}
              </div>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Created
              </p>
              <p>{format(new Date(tool.created_at), 'PPp')}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Updated
              </p>
              <p>{format(new Date(tool.updated_at), 'PPp')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parameters Schema Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Code className="h-4 w-4" />
            Parameters Schema
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tool.parameters && Object.keys(tool.parameters).length > 0 ? (
            <pre className="bg-muted rounded-lg p-4 overflow-auto font-mono text-xs leading-relaxed max-h-[400px]">
              {JSON.stringify(tool.parameters, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              No parameters defined.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Agent Attachment Manager */}
      <AiToolAgentManager tool={tool} />

      {/* Edit Sheet */}
      <AiToolFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        tool={toolForDialogs}
      />

      {/* Delete Dialog */}
      <AiToolDeleteDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open && !toolForDialogs) {
            router.push('/admin/ai/tools');
          }
        }}
        tool={toolForDialogs}
      />
    </div>
  );
}

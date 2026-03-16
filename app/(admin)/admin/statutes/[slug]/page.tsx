'use client';

import { use, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Eye,
  Download,
  Trash2,
  Calendar,
  Globe,
  User,
  Hash,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { StatuteDeleteDialog } from '@/components/admin/statutes/StatuteDeleteDialog';

import { useAdminStatute } from '@/lib/hooks/useAdminStatutes';
import { statutesApi } from '@/lib/api/statutes';

/******************************************************************************
                                Helpers
******************************************************************************/

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default';
    case 'amended':
      return 'secondary';
    case 'repealed':
      return 'destructive';
    default:
      return 'outline';
  }
}

/******************************************************************************
                                Main Component
******************************************************************************/

export default function StatuteDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { data, isLoading } = useAdminStatute(slug);
  const statute = data?.data;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleDeleteSuccess = useCallback(() => {
    router.push('/admin/statutes');
  }, [router]);

  const handleExport = useCallback(async () => {
    if (!statute) return;
    setExporting(true);
    try {
      const xml = await statutesApi.exportAkn(statute.slug);
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${statute.slug}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('AKN XML exported');
    } catch {
      toast.error('Failed to export AKN XML');
    } finally {
      setExporting(false);
    }
  }, [statute]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!statute) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/admin/statutes')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Statutes
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Statute not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/admin/statutes')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{statute.title}</h1>
            {statute.short_title && (
              <p className="text-sm text-muted-foreground">{statute.short_title}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/statutes-v2/${statute.slug}`} target="_blank">
              <Eye className="mr-2 h-4 w-4" />
              View Rendered
            </Link>
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export AKN
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Year
                </p>
                <p className="font-medium">{statute.year}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={statusVariant(statute.status)}>
                  {statute.status_label}
                </Badge>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5" /> Country
                </p>
                <p className="font-medium">
                  {statute.country?.name || '—'}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Commencement
                </p>
                <p className="font-medium">
                  {statute.commencement_date
                    ? format(new Date(statute.commencement_date), 'MMM d, yyyy')
                    : '—'}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> Creator
                </p>
                <p className="font-medium">
                  {statute.creator?.name || '—'}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">
                  {format(new Date(statute.created_at), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Structure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" /> Total Nodes
                </p>
                <p className="text-2xl font-bold tabular-nums">
                  {statute.nodes_count?.toLocaleString() || '—'}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" /> Root Nodes
                </p>
                <p className="text-2xl font-bold tabular-nums">
                  {statute.root_nodes_count?.toLocaleString() || '—'}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Bookmarks</p>
                <p className="font-medium tabular-nums">{statute.bookmarks_count}</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Slug</p>
                <p className="font-mono text-xs text-muted-foreground break-all">
                  {statute.slug}
                </p>
              </div>
            </div>

            {statute.preamble && (
              <div className="space-y-1 pt-2 border-t">
                <p className="text-sm text-muted-foreground">Preamble</p>
                <p className="text-sm leading-relaxed">{statute.preamble}</p>
              </div>
            )}

            {statute.description && (
              <div className="space-y-1 pt-2 border-t">
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="text-sm leading-relaxed">{statute.description}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <StatuteDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        statute={statute}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}

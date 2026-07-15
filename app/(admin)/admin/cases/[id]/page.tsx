'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow, format } from 'date-fns';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Eye,
  Bookmark,
  Calendar,
  User,
  BookOpen,
  Building2,
  Globe,
  Scale,
  FileText,
  Download,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getCaseDisplayTitle } from '@/lib/utils/case-title';

import { CaseDeleteDialog } from '@/components/admin/cases/CaseDeleteDialog';
import { useCase } from '@/lib/hooks/useAdminCases';

/******************************************************************************
                                Component Props
******************************************************************************/

interface CaseDetailPageProps {
  params: Promise<{ id: string }>;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Admin case detail page
 * Read-only view with Edit and Delete actions
 */
export default function CaseDetailPage({ params }: CaseDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  // The ID parameter is actually a slug
  const slug = id;

  // Fetch case by slug
  const { data: caseResponse, isLoading } = useCase(slug);
  const caseData = caseResponse?.data;

  const handleDeleteSuccess = () => {
    router.push('/admin/cases');
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-[150px]" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-[100px]" />
            <Skeleton className="h-10 w-[120px]" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not Found
  if (!caseData) {
    return (
      <div className="space-y-6">
        <Link href="/admin/cases">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Cases
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Case not found
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <Link href="/admin/cases">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Cases
          </Button>
        </Link>
        <div className="flex gap-2">
          <Link href={`/admin/cases/${slug}/edit`}>
            <Button variant="outline">
              <Pencil className="mr-2 h-4 w-4" />
              Edit Case
            </Button>
          </Link>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Case
          </Button>
        </div>
      </div>

      {/* Case Title & Citation */}
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <CardTitle className="text-2xl">{getCaseDisplayTitle(caseData)}</CardTitle>
            {caseData.citation && (
              <p className="font-mono text-sm text-muted-foreground">
                {caseData.citation}
              </p>
            )}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {/* Stats */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    <span>{caseData.views_count} views</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Total Views</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    <Bookmark className="h-4 w-4" />
                    <span>{caseData.bookmarks_count} bookmarks</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Total Bookmarks</TooltipContent>
              </Tooltip>

              {/* Created Date */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">
                    Created {formatDistanceToNow(new Date(caseData.created_at), { addSuffix: true })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {format(new Date(caseData.created_at), 'PPpp')}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Course */}
            {caseData.course && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Course
                </p>
                <Badge variant="secondary">{caseData.course.name}</Badge>
              </div>
            )}

            {/* Topic */}
            {caseData.topic && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Topic
                </p>
                <p className="text-sm">{caseData.topic}</p>
              </div>
            )}

            {/* Level */}
            {caseData.level && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Academic Level
                </p>
                <p className="text-sm">{caseData.level}</p>
              </div>
            )}
          </div>

          {/* Tags */}
          {caseData.tags && caseData.tags.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Tags
              </p>
              <div className="flex flex-wrap gap-2">
                {caseData.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Court Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Court Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Country */}
            {caseData.country && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Globe className="h-4 w-4" />
                  Country
                </p>
                <p className="text-sm">{caseData.country.name}</p>
              </div>
            )}

            {/* Court */}
            {caseData.court && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Scale className="h-4 w-4" />
                  Court
                </p>
                <p className="text-sm">{caseData.court.name}</p>
              </div>
            )}

            {/* Judgment Date */}
            {caseData.judgment_date && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Judgment Date
                </p>
                <p className="text-sm">
                  {format(new Date(caseData.judgment_date), 'PPP')}
                </p>
              </div>
            )}
          </div>

          {/* Judges */}
          {caseData.judges && caseData.judges.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <User className="h-4 w-4" />
                Judges
              </p>
              <div className="flex flex-wrap gap-2">
                {caseData.judges.map((judge) => (
                  <Badge key={judge.id} variant="secondary">
                    {judge.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Case Body */}
      {caseData.body && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Case Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap text-sm">{caseData.body}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legal Information */}
      {caseData.principles && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Legal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Legal Principles
              </p>
              <div className="prose prose-sm max-w-none">
                <p className="whitespace-pre-wrap text-sm">
                  {caseData.principles}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related Cases */}
      {((caseData.similar_cases && caseData.similar_cases.length > 0) ||
        (caseData.cited_cases && caseData.cited_cases.length > 0) ||
        (caseData.cited_by && caseData.cited_by.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Related Cases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Similar Cases */}
            {caseData.similar_cases && caseData.similar_cases.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  Similar Cases
                </p>
                <div className="space-y-2">
                  {caseData.similar_cases.map((relatedCase) => (
                    <Link
                      key={relatedCase.id}
                      href={`/admin/cases/${relatedCase.slug}`}
                      className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <p className="font-medium text-sm">{getCaseDisplayTitle(relatedCase)}</p>
                      {relatedCase.citation && (
                        <p className="text-xs font-mono text-muted-foreground mt-1">
                          {relatedCase.citation}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Cited Cases (outgoing citation edges) */}
            {caseData.cited_cases && caseData.cited_cases.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  Cases Cited
                </p>
                <div className="space-y-2">
                  {caseData.cited_cases.map((edge) => {
                    const linked = edge.cited_case_id !== null && !!edge.slug;
                    const label = edge.display_title || edge.title
                      ? getCaseDisplayTitle(edge)
                      : edge.raw ?? edge.citation ?? 'Unlinked citation';
                    const inner = (
                      <>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{label}</p>
                          {edge.treatment && (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] capitalize">
                              {edge.treatment.replace(/_/g, ' ')}
                            </Badge>
                          )}
                        </div>
                        {edge.citation && (
                          <p className="text-xs font-mono text-muted-foreground mt-1">
                            {edge.citation}
                          </p>
                        )}
                      </>
                    );
                    return linked ? (
                      <Link
                        key={edge.id}
                        href={`/admin/cases/${edge.slug}`}
                        className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div key={edge.id} className="block p-3 rounded-lg border bg-muted/20">
                        {inner}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cited By */}
            {caseData.cited_by && caseData.cited_by.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  Cited By ({caseData.cited_by_count})
                </p>
                <div className="space-y-2">
                  {caseData.cited_by.map((relatedCase) => (
                    <Link
                      key={relatedCase.id}
                      href={`/admin/cases/${relatedCase.slug}`}
                      className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <p className="font-medium text-sm">{getCaseDisplayTitle(relatedCase)}</p>
                      {relatedCase.citation && (
                        <p className="text-xs font-mono text-muted-foreground mt-1">
                          {relatedCase.citation}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Full Report */}
      {caseData.has_full_report && caseData.full_report && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Full Report</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap text-sm">
                {caseData.full_report.full_text}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Files */}
      {caseData.files && caseData.files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Attachments ({caseData.files.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {caseData.files.map((file) => (
                <a
                  key={file.id}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{file.original_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB • {file.mime_type}
                      </p>
                    </div>
                  </div>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Creator Info */}
      {caseData.creator && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Created by{' '}
              <span className="font-medium text-foreground">
                {caseData.creator.name}
              </span>{' '}
              on {format(new Date(caseData.created_at), 'PPP')}
            </p>
            {caseData.updated_at !== caseData.created_at && (
              <p className="text-sm text-muted-foreground mt-1">
                Last updated {formatDistanceToNow(new Date(caseData.updated_at), { addSuffix: true })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Dialog */}
      <CaseDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        case={caseData}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}

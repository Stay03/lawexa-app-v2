'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Scale, Calendar, User, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { CaseDetailSkeleton } from '@/components/cases';
import { PageContainer } from '@/components/layout';
import { useCase } from '@/lib/hooks/useCases';

interface CaseViewPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Case detail view page
 */
function CaseViewPage({ params }: CaseViewPageProps) {
  const { slug } = use(params);
  const { data, isLoading, isError, refetch } = useCase(slug);

  // Format date if available
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <PageContainer variant="detail">
        <CaseDetailSkeleton />
      </PageContainer>
    );
  }

  // Error state
  if (isError) {
    return (
      <PageContainer variant="detail">
        <Link href="/cases">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Cases
          </Button>
        </Link>
        <ErrorState
          title="Failed to load case"
          description="We couldn't load this case. Please try again."
          retry={() => refetch()}
        />
      </PageContainer>
    );
  }

  // Not found state
  if (!data?.data) {
    return (
      <PageContainer variant="detail">
        <Link href="/cases">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Cases
          </Button>
        </Link>
        <EmptyState
          icon={Scale}
          title="Case not found"
          description="The case you're looking for doesn't exist or has been removed."
          action={{ label: 'Browse Cases', onClick: () => {} }}
        />
      </PageContainer>
    );
  }

  const caseDetail = data.data;
  const judgmentDate = formatDate(caseDetail.judgment_date);

  return (
    <PageContainer variant="detail">
      {/* Back navigation */}
      <Link href="/cases">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Cases
        </Button>
      </Link>

      {/* Case header */}
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {caseDetail.title}
        </h1>

        {/* Metadata badges */}
        <div className="flex flex-wrap items-center gap-2">
          {caseDetail.court && (
            <Badge variant="outline">
              <Scale className="mr-1 h-3 w-3" />
              {caseDetail.court.name}
            </Badge>
          )}
          {judgmentDate && (
            <Badge variant="secondary">
              <Calendar className="mr-1 h-3 w-3" />
              {judgmentDate}
            </Badge>
          )}
          {caseDetail.citation && (
            <Badge variant="secondary">{caseDetail.citation}</Badge>
          )}
        </div>

        {/* Tags */}
        {caseDetail.tags && caseDetail.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {caseDetail.tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Case content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            Case Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {caseDetail.body ? (
              <div
                dangerouslySetInnerHTML={{ __html: caseDetail.body }}
                className="whitespace-pre-wrap"
              />
            ) : (
              <p className="text-muted-foreground">{caseDetail.excerpt}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Judges */}
      {caseDetail.judges && caseDetail.judges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Presiding Judges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {caseDetail.judges.map((judge) => (
                <li key={judge.id} className="text-sm">
                  {judge.name}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Principles */}
      {caseDetail.principles && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Legal Principles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {caseDetail.principles}
            </p>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}

export default CaseViewPage;

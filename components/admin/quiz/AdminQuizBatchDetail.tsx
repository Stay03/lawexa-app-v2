'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DifficultyBadge } from '@/components/quiz/DifficultyBadge';
import { AdminQuizBatchStatusBadge } from './AdminQuizBatchStatusBadge';
import { AdminQuizStatusBadge } from './AdminQuizStatusBadge';
import { useAdminQuizBatch } from '@/lib/hooks/useAdminQuiz';
import { extractApiError } from '@/lib/utils/api-error';
import {
  difficultyLabel,
  formatDurationMs,
  formatSessionDate,
  formatTokenCost,
} from '@/lib/utils/quiz-format';

interface AdminQuizBatchDetailProps {
  uuid: string;
}

export function AdminQuizBatchDetail({ uuid }: AdminQuizBatchDetailProps) {
  const query = useAdminQuizBatch(uuid);

  if (query.isLoading) return <DetailSkeleton />;

  if (query.isError || !query.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {query.error ? extractApiError(query.error).message : 'Batch not found.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const b = query.data.data;

  return (
    <div className="space-y-6">
      <BackLink />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <AdminQuizBatchStatusBadge status={b.status} />
            <span className="text-xs capitalize text-muted-foreground">
              {b.source_mode}
            </span>
            {b.user && (
              <span className="text-xs text-muted-foreground">· {b.user.name}</span>
            )}
          </div>
          <CardTitle className="mt-2 text-base">Generation batch</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Questions" value={String(b.questions_generated)} />
          <Stat label="Total tokens" value={b.total_tokens.toLocaleString()} />
          <Stat label="Cost" value={formatTokenCost(b.token_cost)} />
          <Stat label="Prompt tokens" value={b.prompt_tokens.toLocaleString()} />
          <Stat label="Completion tokens" value={b.completion_tokens.toLocaleString()} />
          <Stat
            label="Duration"
            value={b.duration_ms == null ? '—' : formatDurationMs(b.duration_ms)}
          />
        </CardContent>
      </Card>

      {b.error && (
        <div className="flex gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Generation error</p>
            <p className="mt-0.5 break-words">{b.error}</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Created" value={formatSessionDate(b.created_at)} />
          {b.started_at && <Row label="Started" value={formatSessionDate(b.started_at)} />}
          {b.completed_at && (
            <Row label="Completed" value={formatSessionDate(b.completed_at)} />
          )}
          {b.source_conversation && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Source conversation</span>
              <Link
                href={`/admin/conversations/${b.source_conversation.id}`}
                className="font-medium hover:underline"
              >
                #{b.source_conversation.id}
              </Link>
            </div>
          )}
          {b.classifier_request_id && (
            <Row label="Classifier request" value={b.classifier_request_id} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Questions produced ({b.questions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {b.questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No questions from this batch.
            </p>
          ) : (
            b.questions.map((q) => (
              <Link
                key={q.uuid}
                href={`/admin/quiz/questions/${q.uuid}`}
                className="flex items-start gap-2.5 rounded-xl border p-3 transition-colors hover:border-primary/50 hover:bg-accent/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">{q.question_text}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{q.topic}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <DifficultyBadge
                    difficulty={q.difficulty}
                    label={difficultyLabel(q.difficulty)}
                  />
                  <AdminQuizStatusBadge status={q.status} />
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href="/admin/quiz/generation">
        <ArrowLeft className="h-4 w-4" />
        Back to generation
      </Link>
    </Button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all text-right font-medium">{value}</span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

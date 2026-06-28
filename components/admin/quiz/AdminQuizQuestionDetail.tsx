'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DifficultyBadge } from '@/components/quiz/DifficultyBadge';
import { AdminQuizStatusBadge } from './AdminQuizStatusBadge';
import { AdminQuizActionDialog, type AdminQuizAction } from './AdminQuizActionDialog';
import { useAdminQuizQuestion } from '@/lib/hooks/useAdminQuiz';
import { extractApiError } from '@/lib/utils/api-error';
import { formatSessionDate } from '@/lib/utils/quiz-format';
import { cn } from '@/lib/utils';

interface AdminQuizQuestionDetailProps {
  uuid: string;
}

export function AdminQuizQuestionDetail({ uuid }: AdminQuizQuestionDetailProps) {
  const router = useRouter();
  const query = useAdminQuizQuestion(uuid);
  const [action, setAction] = useState<AdminQuizAction | null>(null);

  if (query.isLoading) return <DetailSkeleton />;

  if (query.isError || !query.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {query.error ? extractApiError(query.error).message : 'Question not found.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const q = query.data.data;
  const deleted = !!q.deleted_at;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink />
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/quiz/questions/${uuid}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
          {deleted ? (
            <Button variant="outline" onClick={() => setAction('restore')}>
              Restore
            </Button>
          ) : (
            <>
              {q.status === 'approved' ? (
                <Button variant="outline" onClick={() => setAction('archive')}>
                  Archive
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setAction('approve')}>
                  Approve
                </Button>
              )}
              <Button variant="destructive" onClick={() => setAction('delete')}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <AdminQuizStatusBadge status={q.status} deleted={deleted} />
            <DifficultyBadge difficulty={q.difficulty} label={q.difficulty_label} />
            <span className="text-xs text-muted-foreground">{q.topic}</span>
          </div>
          <CardTitle className="mt-2 text-lg leading-relaxed">
            {q.question_text}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {q.options.map((o) => (
            <div
              key={o.id}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm',
                o.is_correct
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-transparent bg-muted/40'
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full',
                  o.is_correct
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'text-transparent'
                )}
              >
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className={cn('flex-1', o.is_correct && 'font-medium')}>
                {o.option_text}
              </span>
              {o.is_correct && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  Correct
                </span>
              )}
            </div>
          ))}
          {q.explanation && (
            <div className="mt-3 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
              {q.explanation}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Usage</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Stat label="Served" value={String(q.usage.served)} />
            <Stat label="Answered" value={String(q.usage.answered)} />
            <Stat label="Correct" value={String(q.usage.correct)} />
            <Stat
              label="Correct rate"
              value={q.usage.correct_rate == null ? '—' : `${Math.round(q.usage.correct_rate)}%`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {q.generation_batch && (
              <Row
                label="Batch"
                value={
                  <Link
                    href={`/admin/quiz/generation/${q.generation_batch.uuid}`}
                    className="text-primary hover:underline"
                  >
                    {q.generation_batch.source_mode} · {q.generation_batch.status}
                  </Link>
                }
              />
            )}
            {q.source_conversation && (
              <Row
                label="Conversation"
                value={
                  <Link
                    href={`/admin/conversations/${q.source_conversation.id}`}
                    className="text-primary hover:underline"
                  >
                    View source
                  </Link>
                }
              />
            )}
            {q.generated_for_user && (
              <Row
                label="Generated for"
                value={`${q.generated_for_user.name}${
                  q.generated_for_user.email ? ` (${q.generated_for_user.email})` : ''
                }`}
              />
            )}
            {q.course && <Row label="Course" value={q.course} />}
            <Row label="Created" value={formatSessionDate(q.created_at)} />
            <Row label="Updated" value={formatSessionDate(q.updated_at)} />
            <Row
              label="Reviewed"
              value={
                q.moderation.reviewed_by
                  ? `${q.moderation.reviewed_by.name}${
                      q.moderation.reviewed_at
                        ? ` · ${formatSessionDate(q.moderation.reviewed_at)}`
                        : ''
                    }`
                  : '—'
              }
            />
            {q.moderation.notes && <Row label="Notes" value={q.moderation.notes} />}
          </CardContent>
        </Card>
      </div>

      <AdminQuizActionDialog
        action={action}
        question={{ uuid: q.uuid, question_text: q.question_text }}
        open={!!action}
        onOpenChange={(o) => {
          if (!o) setAction(null);
        }}
        onSuccess={
          action === 'delete'
            ? () => router.push('/admin/quiz/questions')
            : undefined
        }
      />
    </div>
  );
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href="/admin/quiz/questions">
        <ArrowLeft className="h-4 w-4" />
        Back to questions
      </Link>
    </Button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}

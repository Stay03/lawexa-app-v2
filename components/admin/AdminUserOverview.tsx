'use client';

import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  ChevronRight,
  GraduationCap,
  MessageSquare,
  Lock,
  Globe,
} from 'lucide-react';
import { ActivityFeedRow } from '@/components/admin/activity/ActivityFeedRow';
import { UserScoreSparkline } from '@/components/admin/quiz/UserScoreSparkline';
import { useUserActivityFeed } from '@/lib/hooks/useAdminActivity';
import { useAdminUserQuizProfile } from '@/lib/hooks/useAdminQuiz';
import { useAdminUserConversations } from '@/lib/hooks/useAdmin';
import { formatDurationMs } from '@/lib/utils/quiz-format';
import { stripPastedTags } from '@/lib/utils';
import type { AdminUserTab } from './user-detail-tabs';

interface AdminUserOverviewProps {
  uuid: string;
  onNavigate: (tab: AdminUserTab) => void;
}

function ViewAllButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
      onClick={onClick}
    >
      View all
      <ChevronRight className="h-3.5 w-3.5" />
    </Button>
  );
}

export function AdminUserOverview({ uuid, onNavigate }: AdminUserOverviewProps) {
  return (
    <div className="space-y-4">
      <QuizSummary uuid={uuid} onNavigate={onNavigate} />
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentActivity uuid={uuid} onNavigate={onNavigate} />
        <RecentConversations uuid={uuid} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Quiz summary                                                               */
/* -------------------------------------------------------------------------- */

function QuizSummary({
  uuid,
  onNavigate,
}: {
  uuid: string;
  onNavigate: (tab: AdminUserTab) => void;
}) {
  const query = useAdminUserQuizProfile(uuid);
  const profile = query.data?.data;

  const accuracy =
    profile && profile.sessions.answered > 0
      ? Math.round(
          (profile.sessions.correct / profile.sessions.answered) * 100
        )
      : null;
  const avgScore = profile?.performance.avg_score ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <GraduationCap className="h-4 w-4" />
          Quiz summary
        </CardTitle>
        <ViewAllButton onClick={() => onNavigate('quiz')} />
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : !profile || profile.sessions.total === 0 ? (
          <p className="text-sm text-muted-foreground">No quiz activity yet.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <Metric value={profile.sessions.total.toLocaleString()} label="sessions" />
            <Metric
              value={accuracy == null ? '—' : `${accuracy}%`}
              label={`accuracy · ${profile.sessions.correct}/${profile.sessions.answered}`}
            />
            <Metric
              value={avgScore == null ? '—' : `${Math.round(avgScore)}%`}
              label="avg score"
            />
            <Metric
              value={
                profile.performance.avg_time_per_question_ms == null
                  ? '—'
                  : formatDurationMs(profile.performance.avg_time_per_question_ms)
              }
              label="avg / question"
            />
            <Metric
              value={profile.generation.questions.toLocaleString()}
              label="questions generated"
            />
            {profile.performance.score_trend.length >= 2 && (
              <div className="ml-auto w-40">
                <UserScoreSparkline data={profile.performance.score_trend} />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Recent activity                                                            */
/* -------------------------------------------------------------------------- */

function RecentActivity({
  uuid,
  onNavigate,
}: {
  uuid: string;
  onNavigate: (tab: AdminUserTab) => void;
}) {
  const feed = useUserActivityFeed(uuid, { per_page: 5 }, { live: false });
  const rows = feed.data?.pages?.[0]?.data?.slice(0, 5) ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4" />
          Recent activity
        </CardTitle>
        <ViewAllButton onClick={() => onNavigate('activity')} />
      </CardHeader>
      <CardContent>
        {feed.isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No activity yet.
          </p>
        ) : (
          <div className="divide-y">
            {rows.map((row) => (
              <ActivityFeedRow key={row.id} row={row} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Recent conversations                                                       */
/* -------------------------------------------------------------------------- */

function RecentConversations({
  uuid,
  onNavigate,
}: {
  uuid: string;
  onNavigate: (tab: AdminUserTab) => void;
}) {
  const router = useRouter();
  const query = useAdminUserConversations(uuid, {
    page: 1,
    per_page: 5,
    sort_by: 'created_at',
    sort_order: 'desc',
  });
  const items = query.data?.data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          Recent conversations
        </CardTitle>
        <ViewAllButton onClick={() => onNavigate('conversations')} />
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No conversations yet.
          </p>
        ) : (
          <div className="divide-y">
            {items.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => router.push(`/admin/conversations/${c.id}`)}
                className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-muted/40"
              >
                {c.is_private ? (
                  <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <Globe className="h-4 w-4 shrink-0 text-green-600" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">
                    {stripPastedTags(c.title || 'Untitled')}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {c.agent?.name || '—'} ·{' '}
                    {formatDistanceToNow(new Date(c.created_at), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {c.messages_count} msg
                </span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

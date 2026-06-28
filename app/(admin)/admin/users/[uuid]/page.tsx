'use client';

import { use, useCallback, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminUser } from '@/lib/hooks/useAdmin';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { ArrowLeft, CalendarClock, Webhook } from 'lucide-react';
import {
  UserDetailHeader,
  UserFreeMessagesBlockDialog,
  UserAttributionCard,
  QuickStatsRow,
  AdminUserOverview,
  AdminUserConversationsTab,
  AdminUserProfilePanel,
  AdminUserConversationFilters,
} from '@/components/admin';
import { UserActivitySection } from '@/components/admin/activity/UserActivitySection';
import { AdminUserQuizSection } from '@/components/admin/quiz/AdminUserQuizSection';
import { AdminUserQuizSessions } from '@/components/admin/quiz/AdminUserQuizSessions';
import {
  ADMIN_USER_TABS,
  ADMIN_USER_TAB_LABELS,
  isAdminUserTab,
  type AdminUserTab,
} from '@/components/admin/user-detail-tabs';

interface AdminUserDetailPageProps {
  params: Promise<{ uuid: string }>;
}

const TAB_TRIGGER_CLASS =
  'flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-active:border-primary data-active:bg-transparent data-active:text-foreground dark:data-active:border-primary dark:data-active:bg-transparent';

export default function AdminUserDetailPage({
  params,
}: AdminUserDetailPageProps) {
  const { uuid } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: userData, isLoading: userLoading, error } = useAdminUser(uuid);
  const { exchangeRate, showNGN } = useCurrencyStore();
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);

  const tabParam = searchParams.get('tab');
  const tab: AdminUserTab = isAdminUserTab(tabParam) ? tabParam : 'overview';

  const setTab = useCallback(
    (value: AdminUserTab) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value === 'overview') next.delete('tab');
      else next.set('tab', value);
      const qs = next.toString();
      router.push(qs ? `/admin/users/${uuid}?${qs}` : `/admin/users/${uuid}`, {
        scroll: false,
      });
    },
    [router, searchParams, uuid]
  );

  if (userLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !userData?.data) {
    return (
      <div className="space-y-4">
        <Link href="/admin/users">
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Users
          </Button>
        </Link>
        <div className="rounded-lg border py-8 text-center text-muted-foreground">
          User not found
        </div>
      </div>
    );
  }

  const user = userData.data;

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link href="/admin/users">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Users
        </Button>
      </Link>

      {/* Identity header */}
      <UserDetailHeader
        user={user}
        onToggleBlock={() => setBlockDialogOpen(true)}
      />

      <UserFreeMessagesBlockDialog
        open={blockDialogOpen}
        onOpenChange={setBlockDialogOpen}
        user={user}
      />

      {/* Unified KPI strip */}
      <QuickStatsRow
        conversationsCount={user.conversations_count}
        usageSummary={user.usage_summary}
        showNGN={showNGN}
        exchangeRate={exchangeRate}
      />

      {/* Tabs: views of the user (left) · actions on the user (right) */}
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as AdminUserTab)}
        className="gap-5"
      >
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b">
          <TabsList className="h-auto gap-6 rounded-none bg-transparent p-0">
            {ADMIN_USER_TABS.map((t) => (
              <TabsTrigger key={t} value={t} className={TAB_TRIGGER_CLASS}>
                {ADMIN_USER_TAB_LABELS[t]}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex items-center gap-2 pb-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href={`/admin/users/${user.uuid}/plan-periods`}>
                <CalendarClock className="h-3.5 w-3.5" />
                Plan periods
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href={`/admin/paystack-webhooks?user_id=${user.id}`}>
                <Webhook className="h-3.5 w-3.5" />
                Paystack webhooks
              </Link>
            </Button>
            <AdminUserConversationFilters />
          </div>
        </div>

        <TabsContent value="overview">
          <AdminUserOverview uuid={uuid} onNavigate={setTab} />
        </TabsContent>

        <TabsContent value="activity">
          <UserActivitySection userUuid={user.uuid} userId={user.id} />
        </TabsContent>

        <TabsContent value="quiz">
          <div className="space-y-5">
            <AdminUserQuizSection uuid={uuid} />
            <AdminUserQuizSessions uuid={uuid} />
          </div>
        </TabsContent>

        <TabsContent value="conversations">
          <AdminUserConversationsTab uuid={uuid} />
        </TabsContent>

        <TabsContent value="profile">
          <div className="grid gap-4 lg:grid-cols-2">
            <AdminUserProfilePanel user={user} />
            <UserAttributionCard
              userUuid={user.uuid}
              attribution={user.attribution}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

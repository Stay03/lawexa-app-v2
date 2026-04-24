'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, ExternalLink } from 'lucide-react';
import { useUserActivityFeed } from '@/lib/hooks/useAdminActivity';
import { ActivityFeedList } from './ActivityFeedList';

interface UserActivitySectionProps {
  userUuid: string;
  userId: number;
}

export function UserActivitySection({ userUuid, userId }: UserActivitySectionProps) {
  const feed = useUserActivityFeed(userUuid, { per_page: 25 }, { live: false });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Activity
        </CardTitle>
        <Link href={`/admin/activity-feed?user_id=${userId}`}>
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            Open full feed
            <ExternalLink className="h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <ActivityFeedList
          pages={feed.data?.pages}
          isLoading={feed.isLoading}
          isFetchingNextPage={feed.isFetchingNextPage}
          hasNextPage={feed.hasNextPage}
          onLoadMore={() => feed.fetchNextPage()}
          error={feed.error as Error | null}
        />
      </CardContent>
    </Card>
  );
}

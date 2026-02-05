'use client';

import { use } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminUser } from '@/lib/hooks/useAdmin';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { ArrowLeft } from 'lucide-react';
import {
  UserIdentityCard,
  QuickStatsRow,
  UserProfileCard,
  AdminUserTokenUsage,
} from '@/components/admin';

interface AdminUserDetailPageProps {
  params: Promise<{ uuid: string }>;
}

export default function AdminUserDetailPage({
  params,
}: AdminUserDetailPageProps) {
  const { uuid } = use(params);
  const { data, isLoading, error } = useAdminUser(uuid);
  const { exchangeRate, showNGN } = useCurrencyStore();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="flex flex-col lg:flex-row gap-6">
          <Skeleton className="h-96 w-full lg:w-72" />
          <div className="flex-1 space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-48" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="space-y-4">
        <Link href="/admin/conversations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Conversations
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            User not found
          </CardContent>
        </Card>
      </div>
    );
  }

  const user = data.data;
  const profile = user.profile;

  // Check if we have any profile data to display
  const hasProfileData =
    profile &&
    (profile.profession ||
      profile.level ||
      profile.city ||
      profile.country ||
      profile.university ||
      profile.area_of_study);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/admin/conversations">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Conversations
        </Button>
      </Link>

      {/* Main Layout: Sidebar + Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar - User Identity */}
        <UserIdentityCard user={user} className="lg:w-72 lg:shrink-0" />

        {/* Right Content - Analytics */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Quick Stats Row */}
          <QuickStatsRow
            conversationsCount={user.conversations_count}
            usageSummary={user.usage_summary}
            showNGN={showNGN}
            exchangeRate={exchangeRate}
          />

          {/* Profile Information (conditional) */}
          {(hasProfileData || user.areas_of_expertise.length > 0) && (
            <UserProfileCard
              profile={user.profile}
              areasOfExpertise={user.areas_of_expertise}
            />
          )}

          {/* Token Usage Breakdown */}
          <AdminUserTokenUsage userUuid={uuid} hideSummary />
        </div>
      </div>
    </div>
  );
}

'use client';

import { use } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useAdminUser } from '@/lib/hooks/useAdmin';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { formatCost } from '@/lib/utils/currency';
import {
  ArrowLeft,
  Shield,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Coins,
  Hash,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { AdminUserTokenUsage } from '@/components/admin/AdminUserTokenUsage';

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
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
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
  const hasProfileData = profile && (
    profile.profession ||
    profile.level ||
    profile.city ||
    profile.country ||
    profile.university ||
    profile.area_of_study
  );

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/admin/conversations">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Conversations
        </Button>
      </Link>

      {/* User Header - UUID Only */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground mb-1">User UUID</p>
              <CardTitle className="font-mono text-lg break-all">
                {user.uuid}
              </CardTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant={user.role === 'admin' || user.role === 'superadmin' ? 'default' : 'secondary'}>
                  {user.role}
                </Badge>
                {user.is_verified ? (
                  <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                    <CheckCircle2 className="h-3 w-3" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-amber-600 border-amber-600">
                    <XCircle className="h-3 w-3" /> Unverified
                  </Badge>
                )}
                {user.is_creator && (
                  <Badge variant="outline" className="gap-1">
                    Creator
                  </Badge>
                )}
              </div>
            </div>
            <Link href={`/admin/users/${uuid}/conversations`}>
              <Button>
                <MessageSquare className="mr-2 h-4 w-4" />
                View Conversations
              </Button>
            </Link>
          </div>
        </CardHeader>
      </Card>

      {/* Consolidated User Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Usage Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> Conversations
              </p>
              <p className="font-semibold text-lg">{user.conversations_count}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Hash className="h-3 w-3" /> Total Tokens
              </p>
              <p className="font-semibold text-lg">{user.usage_summary.total_tokens.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">
                {user.usage_summary.prompt_tokens.toLocaleString()} in / {user.usage_summary.completion_tokens.toLocaleString()} out
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Coins className="h-3 w-3" /> Total Cost
              </p>
              <p className="font-mono font-semibold text-lg">
                {formatCost(user.usage_summary.total_cost, {
                  showNGN,
                  exchangeRate,
                  decimals: 2,
                })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">AI Requests</p>
              <p className="font-semibold text-lg">{user.usage_summary.total_requests}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Shield className="h-3 w-3" /> Auth Provider
              </p>
              <p className="capitalize font-semibold">{user.auth_provider}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Member Since
              </p>
              <p className="font-semibold">{format(new Date(user.created_at), 'PP')}</p>
            </div>
          </div>

          {/* Profile Information - Only show if data exists */}
          {hasProfileData && (
            <>
              <Separator />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                {profile?.profession && (
                  <div>
                    <p className="text-muted-foreground mb-1">Profession</p>
                    <p className="font-medium capitalize">{profile.profession}</p>
                  </div>
                )}
                {profile?.level && (
                  <div>
                    <p className="text-muted-foreground mb-1">Level</p>
                    <p className="font-medium">{profile.level}</p>
                  </div>
                )}
                {profile?.city && (
                  <div>
                    <p className="text-muted-foreground mb-1">City</p>
                    <p className="font-medium">{profile.city}</p>
                  </div>
                )}
                {profile?.country && (
                  <div>
                    <p className="text-muted-foreground mb-1">Country</p>
                    <p className="font-medium">{profile.country}</p>
                  </div>
                )}
                {profile?.university && (
                  <div className="lg:col-span-2">
                    <p className="text-muted-foreground mb-1">University</p>
                    <p className="font-medium">{profile.university}</p>
                  </div>
                )}
                {profile?.area_of_study && (
                  <div>
                    <p className="text-muted-foreground mb-1">Area of Study</p>
                    <p className="font-medium capitalize">{profile.area_of_study}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Areas of Expertise */}
          {user.areas_of_expertise.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-3 text-sm">Areas of Expertise</p>
                <div className="flex flex-wrap gap-2">
                  {user.areas_of_expertise.map((area) => (
                    <Badge key={area.id} variant="secondary">
                      {area.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Token Usage - No Tabs */}
      <AdminUserTokenUsage userUuid={uuid} />
    </div>
  );
}

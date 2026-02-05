'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAdminUser } from '@/lib/hooks/useAdmin';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { formatCost } from '@/lib/utils/currency';
import {
  ArrowLeft,
  Mail,
  Shield,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Coins,
  Hash,
  Calendar,
  MapPin,
  GraduationCap,
  Briefcase,
  ExternalLink,
  User,
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
  const { setOverride, clearOverride } = useBreadcrumbStore();
  const { exchangeRate, showNGN } = useCurrencyStore();

  // Set breadcrumb label to user name
  useEffect(() => {
    if (data?.data?.name) {
      setOverride(uuid, data.data.name);
    }
    return () => {
      clearOverride(uuid);
    };
  }, [data?.data?.name, uuid, setOverride, clearOverride]);

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

  // Get user initials for avatar fallback
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/admin/conversations">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Conversations
        </Button>
      </Link>

      {/* User Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatar_url || undefined} alt={user.name} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="truncate">{user.name}</CardTitle>
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
              <CardDescription className="flex items-center gap-1 mt-1">
                <Mail className="h-3 w-3" /> {user.email}
              </CardDescription>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                UUID: {user.uuid}
              </p>
            </div>
            <Link href={`/admin/users/${uuid}/conversations`}>
              <Button>
                <MessageSquare className="mr-2 h-4 w-4" />
                View Conversations
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {/* Usage Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> Conversations
              </p>
              <p className="font-semibold">{user.conversations_count}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Hash className="h-3 w-3" /> Total Tokens
              </p>
              <p className="font-semibold">{user.usage_summary.total_tokens.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">
                {user.usage_summary.prompt_tokens.toLocaleString()} in / {user.usage_summary.completion_tokens.toLocaleString()} out
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Coins className="h-3 w-3" /> Total Cost
              </p>
              <p className="font-mono font-semibold">
                {formatCost(user.usage_summary.total_cost, {
                  showNGN,
                  exchangeRate,
                  decimals: 4,
                })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">AI Requests</p>
              <p className="font-semibold">{user.usage_summary.total_requests}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Shield className="h-3 w-3" /> Auth Provider
              </p>
              <p className="capitalize">{user.auth_provider}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Member Since
              </p>
              <p>{format(new Date(user.created_at), 'PP')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Profile and Token Usage */}
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="token-usage">
            <Hash className="mr-2 h-4 w-4" />
            Token Usage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          {/* Professional Info */}
          {profile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Professional Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  {profile.profession && (
                    <div>
                      <p className="text-muted-foreground mb-1">Profession</p>
                      <p>{profile.profession}</p>
                    </div>
                  )}
                  {profile.level && (
                    <div>
                      <p className="text-muted-foreground mb-1">Level</p>
                      <p>{profile.level}</p>
                    </div>
                  )}
                  {profile.work_experience && (
                    <div className="md:col-span-2 lg:col-span-3">
                      <p className="text-muted-foreground mb-1">Work Experience</p>
                      <p className="whitespace-pre-wrap">{profile.work_experience}</p>
                    </div>
                  )}
                  {profile.bio && (
                    <div className="md:col-span-2 lg:col-span-3">
                      <p className="text-muted-foreground mb-1">Bio</p>
                      <p className="whitespace-pre-wrap">{profile.bio}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Location */}
          {profile && (profile.city || profile.state || profile.country) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  {profile.city && (
                    <div>
                      <p className="text-muted-foreground mb-1">City</p>
                      <p>{profile.city}</p>
                    </div>
                  )}
                  {profile.state && (
                    <div>
                      <p className="text-muted-foreground mb-1">State</p>
                      <p>{profile.state}</p>
                    </div>
                  )}
                  {profile.country && (
                    <div>
                      <p className="text-muted-foreground mb-1">Country</p>
                      <p>{profile.country}</p>
                    </div>
                  )}
                  {profile.address && (
                    <div className="md:col-span-3">
                      <p className="text-muted-foreground mb-1">Address</p>
                      <p>{profile.address}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Education */}
          {profile && (profile.law_school || profile.university || profile.call_to_bar_year) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" /> Education & Bar Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  {profile.law_school && (
                    <div>
                      <p className="text-muted-foreground mb-1">Law School</p>
                      <p>{profile.law_school}</p>
                    </div>
                  )}
                  {profile.university && (
                    <div>
                      <p className="text-muted-foreground mb-1">University</p>
                      <p>{profile.university}</p>
                    </div>
                  )}
                  {profile.area_of_study && (
                    <div>
                      <p className="text-muted-foreground mb-1">Area of Study</p>
                      <p>{profile.area_of_study}</p>
                    </div>
                  )}
                  {profile.call_to_bar_year && (
                    <div>
                      <p className="text-muted-foreground mb-1">Call to Bar Year</p>
                      <p>{profile.call_to_bar_year}</p>
                    </div>
                  )}
                  {profile.call_number && (
                    <div>
                      <p className="text-muted-foreground mb-1">Call Number</p>
                      <p>{profile.call_number}</p>
                    </div>
                  )}
                  {profile.other_certifications && (
                    <div className="md:col-span-2 lg:col-span-3">
                      <p className="text-muted-foreground mb-1">Other Certifications</p>
                      <p className="whitespace-pre-wrap">{profile.other_certifications}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Areas of Expertise */}
          {user.areas_of_expertise.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Areas of Expertise</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {user.areas_of_expertise.map((area) => (
                    <Badge key={area.id} variant="secondary">
                      {area.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Social Links */}
          {profile && (profile.linkedin_url || profile.website_url || profile.twitter_url || profile.facebook_url) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" /> Social Links
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {profile.linkedin_url && (
                    <a
                      href={profile.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      LinkedIn
                    </a>
                  )}
                  {profile.website_url && (
                    <a
                      href={profile.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Website
                    </a>
                  )}
                  {profile.twitter_url && (
                    <a
                      href={profile.twitter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Twitter
                    </a>
                  )}
                  {profile.facebook_url && (
                    <a
                      href={profile.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Facebook
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No profile data */}
          {!profile && user.areas_of_expertise.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No profile information available
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="token-usage">
          <AdminUserTokenUsage userUuid={uuid} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

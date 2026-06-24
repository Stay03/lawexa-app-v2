'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CheckCircle2,
  XCircle,
  Ban,
  Shield,
  Calendar,
  Copy,
  Check,
  Briefcase,
  MapPin,
  GraduationCap,
  Building2,
  Scale,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import type { AdminUserDetail } from '@/types/admin';
import { cn } from '@/lib/utils';

interface UserIdentityCardProps {
  user: AdminUserDetail;
  className?: string;
}

export function UserIdentityCard({ user, className }: UserIdentityCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyUuid = async () => {
    await navigator.clipboard.writeText(user.uuid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const profile = user.profile;
  const hasProfileData =
    profile &&
    (profile.profession ||
      profile.level ||
      profile.city ||
      profile.country ||
      profile.university ||
      profile.law_school ||
      profile.area_of_study);

  // Build location string
  const locationString = [profile?.city, profile?.country]
    .filter(Boolean)
    .join(', ');

  return (
    <Card className={cn('w-full shadow-none border-muted', className)}>
      <CardContent className="pt-5 flex flex-col space-y-3">
        {/* UUID - Primary Identifier */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            User UUID
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleCopyUuid}
                className="inline-flex items-center gap-2 font-mono text-sm hover:text-primary transition-colors break-all text-left"
              >
                <span>{user.uuid}</span>
                {copied ? (
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <Copy className="h-4 w-4 shrink-0" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Click to copy</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={
              user.role === 'admin' || user.role === 'superadmin'
                ? 'default'
                : 'secondary'
            }
          >
            {user.role}
          </Badge>
          {user.is_verified ? (
            <Badge
              variant="outline"
              className="gap-1 text-green-600 border-green-600"
            >
              <CheckCircle2 className="h-3 w-3" /> Verified
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 text-amber-600 border-amber-600"
            >
              <XCircle className="h-3 w-3" /> Unverified
            </Badge>
          )}
          {user.is_creator && (
            <Badge variant="outline" className="gap-1">
              Creator
            </Badge>
          )}
          {user.free_messages_blocked && (
            <Badge
              variant="outline"
              className="gap-1 text-red-600 border-red-600"
            >
              <Ban className="h-3 w-3" /> Free messages blocked
            </Badge>
          )}
        </div>

        <Separator />

        {/* Account Metadata */}
        <div className="w-full space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Auth Provider
            </span>
            <span className="capitalize font-medium">{user.auth_provider}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Member Since
            </span>
            <span className="font-medium">
              {format(new Date(user.created_at), 'PP')}
            </span>
          </div>
        </div>

        {/* Profile Information */}
        {hasProfileData && (
          <>
            <Separator />
            <div className="w-full space-y-3 text-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Profile
              </p>
              {profile?.profession && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" />
                    Profession
                  </span>
                  <span className="font-medium capitalize">
                    {profile.profession}
                  </span>
                </div>
              )}
              {profile?.level && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Level
                  </span>
                  <span className="font-medium">{profile.level}</span>
                </div>
              )}
              {locationString && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    Location
                  </span>
                  <span className="font-medium">{locationString}</span>
                </div>
              )}
              {profile?.university && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    University
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-medium text-right max-w-[140px] truncate cursor-help">
                        {profile.university}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left"><p>{profile.university}</p></TooltipContent>
                  </Tooltip>
                </div>
              )}
              {profile?.law_school && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Scale className="h-3.5 w-3.5" />
                    Law School
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-medium text-right max-w-[140px] truncate cursor-help">
                        {profile.law_school}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left"><p>{profile.law_school}</p></TooltipContent>
                  </Tooltip>
                </div>
              )}
              {profile?.area_of_study && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5" />
                    Area of Study
                  </span>
                  <span className="font-medium capitalize">
                    {profile.area_of_study}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Areas of Expertise */}
        {user.areas_of_expertise.length > 0 && (
          <>
            <Separator />
            <div className="w-full">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Areas of Expertise
              </p>
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
  );
}

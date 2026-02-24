'use client';

import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { LawyerVerificationStatusBadge } from './LawyerVerificationStatusBadge';
import type { AdminLawyerVerificationDetail } from '@/types/admin-lawyer-verification';

interface LawyerVerificationInfoCardProps {
  item: AdminLawyerVerificationDetail;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Left sidebar info card for the lawyer verification detail page.
 * Shows user info, status, dates, verifier, and notes/reason.
 */
export function LawyerVerificationInfoCard({
  item,
  className,
}: LawyerVerificationInfoCardProps) {
  return (
    <Card className={cn(className)}>
      <CardContent className="p-6 space-y-5">
        {/* User Info */}
        <div className="flex flex-col items-center text-center">
          <Avatar className="h-16 w-16 mb-3">
            <AvatarImage
              src={item.user.avatar_url ?? undefined}
              alt={item.user.name}
            />
            <AvatarFallback className="text-lg">
              {getInitials(item.user.name)}
            </AvatarFallback>
          </Avatar>
          <h3 className="font-semibold text-lg">{item.user.name}</h3>
          <p className="text-sm text-muted-foreground">{item.user.email}</p>
          <div className="mt-3">
            <LawyerVerificationStatusBadge
              isVerified={item.is_verified}
              submittedAt={item.verification_submitted_at}
              rejectionReason={item.rejection_reason}
            />
          </div>
        </div>

        <Separator />

        {/* Dates */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Timeline
          </h4>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Profile Created</span>
              <span className="font-medium">
                {format(new Date(item.created_at), 'MMM d, yyyy')}
              </span>
            </div>

            {item.verification_submitted_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Submitted</span>
                <span className="font-medium">
                  {format(
                    new Date(item.verification_submitted_at),
                    'MMM d, yyyy'
                  )}
                </span>
              </div>
            )}

            {item.verified_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Verified</span>
                <span className="font-medium">
                  {format(new Date(item.verified_at), 'MMM d, yyyy')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Verifier */}
        {item.verifier && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Reviewed By
              </h4>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage
                    src={item.verifier.avatar_url ?? undefined}
                    alt={item.verifier.name}
                  />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(item.verifier.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.verifier.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.verifier.email}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Verification Notes (if approved) */}
        {item.verification_notes && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Admin Notes
              </h4>
              <div className="rounded-md bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 p-3">
                <p className="text-sm text-green-800 dark:text-green-300">
                  {item.verification_notes}
                </p>
              </div>
            </div>
          </>
        )}

        {/* Rejection Reason (if rejected) */}
        {item.rejection_reason && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Rejection Reason
              </h4>
              <div className="rounded-md bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-3">
                <p className="text-sm text-red-800 dark:text-red-300">
                  {item.rejection_reason}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

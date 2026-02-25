'use client';

import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LawyerProfile } from '@/lib/api/lawyerVerification';

interface VerificationTimelineCardProps {
  profile: LawyerProfile;
}

export function VerificationTimelineCard({ profile }: VerificationTimelineCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Profile Created</span>
            <span className="font-medium">
              {format(new Date(profile.created_at), 'MMM d, yyyy')}
            </span>
          </div>

          {profile.verification_submitted_at && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Submitted</span>
              <span className="font-medium">
                {format(new Date(profile.verification_submitted_at), 'MMM d, yyyy')}
              </span>
            </div>
          )}

          {profile.verified_at && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Verified</span>
              <span className="font-medium">
                {format(new Date(profile.verified_at), 'MMM d, yyyy')}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import {
  FileEdit,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LawyerVerificationStatusBadge } from '@/components/admin/lawyer-verifications/LawyerVerificationStatusBadge';
import type { LawyerProfile } from '@/lib/api/lawyerVerification';

interface VerificationStatusCardProps {
  profile: LawyerProfile;
}

const statusConfig = {
  draft: {
    icon: FileEdit,
    title: 'Verification Not Started',
    description:
      "You haven't submitted your verification documents yet. Upload your documents to get verified and start receiving client referrals.",
    colorClass: 'text-muted-foreground bg-muted',
  },
  pending: {
    icon: Clock,
    title: 'Verification Under Review',
    description:
      'Your documents have been submitted and are being reviewed by our team. This typically takes 1-3 business days.',
    colorClass:
      'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
  },
  approved: {
    icon: CheckCircle2,
    title: 'Verification Approved',
    description:
      'Your identity has been verified. You now have a verified badge and can receive client referrals.',
    colorClass:
      'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
  },
  rejected: {
    icon: XCircle,
    title: 'Verification Rejected',
    description:
      'Your verification submission was not approved. Please review the reason below and resubmit with the correct documents.',
    colorClass:
      'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
  },
};

export function VerificationStatusCard({ profile }: VerificationStatusCardProps) {
  const config = statusConfig[profile.verification_status];
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Verification Status</span>
          <LawyerVerificationStatusBadge
            isVerified={profile.is_verified ?? false}
            submittedAt={profile.verification_submitted_at}
            rejectionReason={profile.rejection_reason}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-4">
          <div className={`rounded-full p-3 shrink-0 ${config.colorClass}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold">{config.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {config.description}
            </p>
          </div>
        </div>

        {/* Verification notes (approved) */}
        {profile.verification_status === 'approved' && profile.verification_notes && (
          <div className="rounded-md bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 p-3">
            <h4 className="text-xs font-medium text-green-800 dark:text-green-300 uppercase tracking-wider mb-1">
              Admin Notes
            </h4>
            <p className="text-sm text-green-800 dark:text-green-300">
              {profile.verification_notes}
            </p>
          </div>
        )}

        {/* Rejection reason (rejected) */}
        {profile.verification_status === 'rejected' && profile.rejection_reason && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-medium text-red-800 dark:text-red-300 uppercase tracking-wider mb-1">
                  Rejection Reason
                </h4>
                <p className="text-sm text-red-800 dark:text-red-300">
                  {profile.rejection_reason}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

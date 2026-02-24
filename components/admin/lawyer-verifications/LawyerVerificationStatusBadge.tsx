'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

interface LawyerVerificationStatusBadgeProps {
  isVerified: boolean;
  submittedAt: string | null;
  rejectionReason?: string | null;
}

/**
 * Color-coded status badge for lawyer verification.
 * Derives the display status from is_verified + verification_submitted_at fields.
 */
export function LawyerVerificationStatusBadge({
  isVerified,
  submittedAt,
  rejectionReason,
}: LawyerVerificationStatusBadgeProps) {
  // Approved
  if (isVerified) {
    return (
      <Badge
        variant="outline"
        className="gap-1 text-green-600 border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
      >
        <CheckCircle2 className="h-3 w-3" />
        Approved
      </Badge>
    );
  }

  // Rejected (not verified, has a rejection reason)
  if (rejectionReason) {
    return (
      <Badge
        variant="outline"
        className="gap-1 text-red-600 border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
      >
        <XCircle className="h-3 w-3" />
        Rejected
      </Badge>
    );
  }

  // Pending (submitted but not yet decided)
  if (submittedAt) {
    return (
      <Badge
        variant="outline"
        className="gap-1 text-amber-600 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
      >
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    );
  }

  // Draft / Not submitted
  return (
    <Badge variant="secondary" className="gap-1 text-muted-foreground">
      Draft
    </Badge>
  );
}

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATUS_TONE } from './webhook-meta';
import type { PaystackWebhookProcessingStatus } from '@/types/admin-paystack-webhooks';

interface ProcessingStatusBadgeProps {
  status: PaystackWebhookProcessingStatus;
  className?: string;
}

export function ProcessingStatusBadge({
  status,
  className,
}: ProcessingStatusBadgeProps) {
  const tone = STATUS_TONE[status];
  return (
    <Badge variant="outline" className={cn(tone.className, className)}>
      {tone.label}
    </Badge>
  );
}

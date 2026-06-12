import { CheckCircle2, Clock, Loader2, XCircle, CircleSlash } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { ScanStatus } from '@/types/radar';

const STATUS_CONFIG: Record<
  ScanStatus,
  {
    label: string;
    variant: 'secondary' | 'outline' | 'destructive';
    icon: LucideIcon;
    spin?: boolean;
  }
> = {
  queued: { label: 'Queued', variant: 'outline', icon: Clock },
  running: { label: 'Running', variant: 'outline', icon: Loader2, spin: true },
  completed: { label: 'Completed', variant: 'secondary', icon: CheckCircle2 },
  failed: { label: 'Failed', variant: 'destructive', icon: XCircle },
  skipped_no_balance: {
    label: 'Skipped — no balance',
    variant: 'destructive',
    icon: CircleSlash,
  },
};

interface ScanStatusBadgeProps {
  status: ScanStatus;
}

function ScanStatusBadge({ status }: ScanStatusBadgeProps) {
  const { label, variant, icon: Icon, spin } = STATUS_CONFIG[status];
  return (
    <Badge variant={variant}>
      <Icon className={spin ? 'animate-spin' : undefined} />
      {label}
    </Badge>
  );
}

export { ScanStatusBadge };

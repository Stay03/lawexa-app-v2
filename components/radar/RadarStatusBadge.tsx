import { Badge } from '@/components/ui/badge';
import type { RadarStatus } from '@/types/radar';

const STATUS_CONFIG: Record<
  RadarStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  active: { label: 'Active', variant: 'default' },
  paused: { label: 'Paused', variant: 'secondary' },
  archived: { label: 'Archived', variant: 'outline' },
};

interface RadarStatusBadgeProps {
  status: RadarStatus;
}

function RadarStatusBadge({ status }: RadarStatusBadgeProps) {
  const { label, variant } = STATUS_CONFIG[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export { RadarStatusBadge };

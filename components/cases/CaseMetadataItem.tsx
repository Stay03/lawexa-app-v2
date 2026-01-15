import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CaseMetadataItemProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  className?: string;
  animationDelay?: number;
}

/**
 * Individual metadata display item for the case detail grid
 */
function CaseMetadataItem({
  icon: Icon,
  label,
  value,
  className,
  animationDelay = 0,
}: CaseMetadataItemProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-lg bg-muted/30 p-4',
        'animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both',
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

export { CaseMetadataItem };

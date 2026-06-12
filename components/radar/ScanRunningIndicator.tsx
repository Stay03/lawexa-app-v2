import { cn } from '@/lib/utils';

interface ScanRunningIndicatorProps {
  label: string;
  className?: string;
}

function ScanRunningIndicator({ label, className }: ScanRunningIndicatorProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-sm font-medium text-primary',
        className
      )}
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-primary" />
      </span>
      {label}
    </div>
  );
}

export { ScanRunningIndicator };

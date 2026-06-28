import { cn } from '@/lib/utils';

interface QuizStatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  valueClassName?: string;
}

/** A single headline metric on the stats screen. */
export function QuizStatCard({
  label,
  value,
  sub,
  icon,
  valueClassName,
}: QuizStatCardProps) {
  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={cn('mt-2 text-2xl font-bold tabular-nums', valueClassName)}>
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

import { cn } from '@/lib/utils';

interface QuizMessageProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Centered message panel reused for the player's empty / ended / error states
 * (cold start, load failure, ended session, etc.).
 */
export function QuizMessage({
  icon,
  title,
  description,
  action,
  className,
}: QuizMessageProps) {
  return (
    <div
      className={cn(
        'mx-auto flex max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center animate-in fade-in duration-300 motion-reduce:animate-none',
        className
      )}
    >
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

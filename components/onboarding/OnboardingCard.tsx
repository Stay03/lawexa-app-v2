'use client';

import { cn } from '@/lib/utils';

interface OnboardingCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected?: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  animationDelay?: number;
}

export function OnboardingCard({
  icon,
  title,
  description,
  selected,
  onClick,
  disabled,
  className,
  animationDelay = 0,
}: OnboardingCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative w-full rounded-2xl border bg-card p-6 text-left transition-all duration-200',
        'hover:border-primary/50 hover:bg-accent/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        'disabled:pointer-events-none disabled:opacity-50',
        'animate-in fade-in slide-in-from-bottom-4',
        selected && 'border-primary ring-2 ring-primary/20 bg-primary/5',
        !selected && 'border-border',
        className
      )}
      style={{ animationDelay: `${animationDelay}ms`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors duration-200',
            selected
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
          )}
        >
          {icon}
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {/* Selection indicator */}
      <div
        className={cn(
          'absolute right-4 top-4 h-5 w-5 rounded-full border-2 transition-all duration-200',
          selected
            ? 'border-primary bg-primary'
            : 'border-muted-foreground/30'
        )}
      >
        {selected && (
          <svg
            className="h-full w-full text-primary-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
    </button>
  );
}

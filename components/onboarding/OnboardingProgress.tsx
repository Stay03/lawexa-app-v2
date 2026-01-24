'use client';

import { cn } from '@/lib/utils';

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNumber = i + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;

        return (
          <div
            key={i}
            className={cn(
              'h-2 rounded-full transition-all duration-300 ease-out',
              isActive ? 'w-8 bg-primary' : 'w-2',
              isCompleted && 'bg-primary/60',
              !isActive && !isCompleted && 'bg-muted'
            )}
          />
        );
      })}
    </div>
  );
}

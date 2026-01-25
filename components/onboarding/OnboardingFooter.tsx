'use client';

import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OnboardingFooterProps {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  backLabel?: string;
  isLoading?: boolean;
  isNextDisabled?: boolean;
  showBack?: boolean;
  skipOption?: {
    label: string;
    onClick: () => void;
  };
}

export function OnboardingFooter({
  onBack,
  onNext,
  nextLabel = 'Next',
  backLabel = 'Back',
  isLoading = false,
  isNextDisabled = false,
  showBack = true,
  skipOption,
}: OnboardingFooterProps) {
  return (
    <>
      {/* Desktop: inline buttons */}
      <div className="hidden md:flex gap-3">
        {showBack && onBack && (
          <Button
            variant="ghost"
            onClick={onBack}
            disabled={isLoading}
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Button>
        )}
        <Button
          onClick={onNext}
          disabled={isNextDisabled || isLoading}
          className={showBack && onBack ? 'flex-1' : 'w-full'}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="mr-2 h-4 w-4" />
          )}
          {nextLabel}
        </Button>
      </div>

      {/* Desktop: skip option */}
      {skipOption && (
        <button
          onClick={skipOption.onClick}
          disabled={isLoading}
          className="hidden md:block w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {skipOption.label}
        </button>
      )}

      {/* Mobile: fixed footer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 md:hidden">
        <div className="flex gap-3 max-w-lg mx-auto">
          {showBack && onBack && (
            <Button
              variant="ghost"
              onClick={onBack}
              disabled={isLoading}
              className="flex-1"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {backLabel}
            </Button>
          )}
          <Button
            onClick={onNext}
            disabled={isNextDisabled || isLoading}
            className={showBack && onBack ? 'flex-1' : 'w-full'}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            {nextLabel}
          </Button>
        </div>
        {skipOption && (
          <button
            onClick={skipOption.onClick}
            disabled={isLoading}
            className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {skipOption.label}
          </button>
        )}
      </div>
    </>
  );
}

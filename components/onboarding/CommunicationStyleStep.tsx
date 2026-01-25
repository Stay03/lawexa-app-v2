'use client';

import { Briefcase, BookOpen, HandHelping, Loader2, Sparkles } from 'lucide-react';
import { OnboardingCard } from './OnboardingCard';
import { Badge } from '@/components/ui/badge';
import type { UserType, CommunicationStyle } from '@/types/auth';

const ALL_STYLE_OPTIONS: {
  id: CommunicationStyle;
  label: string;
  description: string;
  icon: typeof Briefcase;
  suggestedFor: UserType;
}[] = [
  {
    id: 'co_worker',
    label: 'Co-worker',
    description: 'Speak to me as a professional peer with legal expertise',
    icon: Briefcase,
    suggestedFor: 'lawyer',
  },
  {
    id: 'study_guide',
    label: 'Study Guide',
    description: 'Help me learn with educational explanations and examples',
    icon: BookOpen,
    suggestedFor: 'law_student',
  },
  {
    id: 'assistant',
    label: 'Friendly Assistant',
    description: 'Clear explanations tailored to your profession and needs',
    icon: HandHelping,
    suggestedFor: 'other',
  },
];

interface CommunicationStyleStepProps {
  userType: UserType;
  onSelect: (style: CommunicationStyle) => void;
  isSubmitting: boolean;
  selectedStyle?: CommunicationStyle | null;
}

export function CommunicationStyleStep({
  userType,
  onSelect,
  isSubmitting,
  selectedStyle,
}: CommunicationStyleStepProps) {
  // Get the suggested style based on user type
  const suggestedStyle = ALL_STYLE_OPTIONS.find(opt => opt.suggestedFor === userType)?.id;

  // Sort options to put suggested one first
  const sortedOptions = [...ALL_STYLE_OPTIONS].sort((a, b) => {
    if (a.suggestedFor === userType) return -1;
    if (b.suggestedFor === userType) return 1;
    return 0;
  });

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          How do you want Lawexa to speak to you?
        </h1>
        <p className="text-muted-foreground">
          Choose your preferred communication style
        </p>
      </div>

      <div className="grid gap-4">
        {sortedOptions.map((option, index) => {
          const isSuggested = option.id === suggestedStyle;
          const isSelected = selectedStyle === option.id;

          return (
            <div key={option.id} className="relative">
              {isSuggested && (
                <Badge
                  variant="default"
                  className="absolute -top-2 left-4 z-10 gap-1 bg-primary text-primary-foreground"
                >
                  <Sparkles className="h-3 w-3" />
                  Suggested for you
                </Badge>
              )}
              <OnboardingCard
                icon={
                  isSubmitting && isSelected ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <option.icon className="h-6 w-6" />
                  )
                }
                title={option.label}
                description={option.description}
                selected={isSelected}
                onClick={() => !isSubmitting && onSelect(option.id)}
                disabled={isSubmitting}
                animationDelay={index * 100}
                className={isSuggested && !isSelected ? 'border-primary/30' : ''}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

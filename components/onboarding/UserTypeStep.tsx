'use client';

import { Scale, GraduationCap, User } from 'lucide-react';
import { OnboardingCard } from './OnboardingCard';
import type { UserType } from '@/types/auth';

const USER_TYPE_OPTIONS = [
  {
    id: 'lawyer' as const,
    label: 'Lawyer',
    description: 'I am a practicing lawyer or legal professional',
    icon: Scale,
  },
  {
    id: 'law_student' as const,
    label: 'Law Student',
    description: 'I am currently studying law or preparing for bar exams',
    icon: GraduationCap,
  },
  {
    id: 'other' as const,
    label: 'Others',
    description: 'I have general interest in legal research and information',
    icon: User,
  },
];

interface UserTypeStepProps {
  onSelect: (type: UserType) => void;
  selectedType?: UserType | null;
}

export function UserTypeStep({ onSelect, selectedType }: UserTypeStepProps) {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          What best describes you?
        </h1>
        <p className="text-muted-foreground">
          This helps us personalize your Lawexa experience
        </p>
      </div>

      <div className="grid gap-4">
        {USER_TYPE_OPTIONS.map((option, index) => (
          <OnboardingCard
            key={option.id}
            icon={<option.icon className="h-6 w-6" />}
            title={option.label}
            description={option.description}
            selected={selectedType === option.id}
            onClick={() => onSelect(option.id)}
            animationDelay={index * 100}
          />
        ))}
      </div>
    </div>
  );
}

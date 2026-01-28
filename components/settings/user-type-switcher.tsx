'use client';

import { Scale, GraduationCap, Briefcase, Building2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { UseFormReturn } from 'react-hook-form';
import type { ProfileFormValues } from '@/lib/utils/profile-validation';
import type { UserType } from '@/types/auth';
import type { StudentEducationLevel } from '@/types/onboarding';

interface UserTypeSwitcherProps {
  form: UseFormReturn<ProfileFormValues>;
}

const USER_TYPE_OPTIONS: {
  id: UserType;
  label: string;
  description: string;
  icon: typeof Scale;
}[] = [
  {
    id: 'lawyer',
    label: 'Lawyer',
    description: 'Practicing lawyer or legal professional',
    icon: Scale,
  },
  {
    id: 'law_student',
    label: 'Law Student',
    description: 'Currently studying law or preparing for bar exams',
    icon: GraduationCap,
  },
  {
    id: 'other',
    label: 'Professional / Other',
    description: 'Business owner, researcher, journalist, or other',
    icon: Briefcase,
  },
];

const EDUCATION_LEVEL_OPTIONS: {
  id: StudentEducationLevel;
  label: string;
  icon: typeof GraduationCap;
}[] = [
  {
    id: 'university',
    label: 'University',
    icon: GraduationCap,
  },
  {
    id: 'law_school',
    label: 'Law School',
    icon: Building2,
  },
];

export function UserTypeSwitcher({ form }: UserTypeSwitcherProps) {
  const selectedType = form.watch('user_type');
  const selectedLevel = form.watch('student_education_level');

  function handleTypeSelect(type: UserType) {
    form.setValue('user_type', type, { shouldDirty: true });

    // Auto-set profession based on type
    if (type === 'lawyer') {
      form.setValue('profession', 'lawyer', { shouldDirty: true });
      form.setValue('student_education_level', null, { shouldDirty: true });
    } else if (type === 'law_student') {
      form.setValue('profession', 'student', { shouldDirty: true });
    } else {
      // For "other", clear the auto-set professions so user can pick
      const currentProfession = form.getValues('profession');
      if (currentProfession === 'lawyer' || currentProfession === 'student') {
        form.setValue('profession', '', { shouldDirty: true });
      }
      form.setValue('student_education_level', null, { shouldDirty: true });
    }
  }

  function handleLevelSelect(level: StudentEducationLevel) {
    form.setValue('student_education_level', level, { shouldDirty: true });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Account Type
        </CardTitle>
        <CardDescription>
          What best describes you? This determines which fields are shown.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {USER_TYPE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleTypeSelect(option.id)}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-4 text-left transition-all',
                'hover:border-primary/50 hover:bg-accent/50',
                selectedType === option.id
                  ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                  : 'border-border bg-card'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
                  selectedType === option.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <option.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm">{option.label}</p>
                <p className="text-xs text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Education level sub-selector for law students */}
        {selectedType === 'law_student' && (
          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium text-muted-foreground">
              Where are you studying?
            </p>
            <div className="grid grid-cols-2 gap-3">
              {EDUCATION_LEVEL_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleLevelSelect(option.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border p-3 text-left transition-all',
                    'hover:border-primary/50 hover:bg-accent/50',
                    selectedLevel === option.id
                      ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                      : 'border-border bg-card'
                  )}
                >
                  <option.icon className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

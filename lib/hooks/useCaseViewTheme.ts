'use client';

import { useCaseViewThemeStore } from '@/lib/stores/caseViewThemeStore';
import type { CaseViewTheme } from '@/lib/stores/caseViewThemeStore';

export function useCaseViewTheme() {
  const { caseViewTheme, setCaseViewTheme } = useCaseViewThemeStore();

  return {
    caseViewTheme,
    setCaseViewTheme,
    isBlogTheme: caseViewTheme === 'blog',
    isDefaultTheme: caseViewTheme === 'default',
  };
}

export type { CaseViewTheme };

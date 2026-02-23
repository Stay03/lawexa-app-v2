import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CaseViewTheme = 'default' | 'blog';

interface CaseViewThemeStore {
  caseViewTheme: CaseViewTheme;
  setCaseViewTheme: (theme: CaseViewTheme) => void;
}

export const useCaseViewThemeStore = create<CaseViewThemeStore>()(
  persist(
    (set) => ({
      caseViewTheme: 'default',
      setCaseViewTheme: (theme) => set({ caseViewTheme: theme }),
    }),
    {
      name: 'lawexa-case-view-theme',
    }
  )
);

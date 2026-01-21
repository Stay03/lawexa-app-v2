import { create } from 'zustand';

interface BreadcrumbOverride {
  segment: string;
  label: string;
}

interface BreadcrumbStore {
  overrides: BreadcrumbOverride[];
  setOverride: (segment: string, label: string) => void;
  clearOverride: (segment: string) => void;
  clearAll: () => void;
  getLabel: (segment: string) => string | undefined;
}

export const useBreadcrumbStore = create<BreadcrumbStore>((set, get) => ({
  overrides: [],

  setOverride: (segment, label) => {
    set((state) => {
      const filtered = state.overrides.filter((o) => o.segment !== segment);
      return { overrides: [...filtered, { segment, label }] };
    });
  },

  clearOverride: (segment) => {
    set((state) => ({
      overrides: state.overrides.filter((o) => o.segment !== segment),
    }));
  },

  clearAll: () => {
    set({ overrides: [] });
  },

  getLabel: (segment) => {
    return get().overrides.find((o) => o.segment === segment)?.label;
  },
}));

'use client';

import { useWriterModeStore } from '@/lib/stores/writerModeStore';

/**
 * Hook for accessing Writer Mode state and actions
 */
export function useWriterMode() {
  const { isWriterModeEnabled, toggleWriterMode, enableWriterMode, disableWriterMode } =
    useWriterModeStore();

  return {
    isWriterModeEnabled,
    toggleWriterMode,
    enableWriterMode,
    disableWriterMode,
  };
}

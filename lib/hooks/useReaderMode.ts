'use client';

import { useReaderModeStore } from '@/lib/stores/readerModeStore';

/**
 * Hook for accessing Reader Mode state and actions
 */
export function useReaderMode() {
  const { isReaderModeEnabled, toggleReaderMode, enableReaderMode, disableReaderMode } =
    useReaderModeStore();

  return {
    isReaderModeEnabled,
    toggleReaderMode,
    enableReaderMode,
    disableReaderMode,
  };
}

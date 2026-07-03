'use client';

import { useSyncExternalStore } from 'react';
import { useAmbassadorPopupStore } from '@/lib/stores/ambassadorPopupStore';

// Hydration-safe "have we mounted on the client?" without a setState-in-effect:
// false on the server and during hydration, true once the client takes over.
const subscribeNoop = () => () => {};
function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

export interface AmbassadorPopupState {
  /** True only after the client has mounted — gate UI on this to avoid hydration mismatch. */
  mounted: boolean;
  /** True while a "remind me later" snooze is active or the popup was permanently dismissed. */
  isDismissed: boolean;
  remindLater: (days?: number) => void;
  dismissForever: () => void;
}

/**
 * UI-facing view over the ambassador popup dismissal store. The actual clock read
 * (expiring a stale snooze) happens once on mount inside <AmbassadorProgramPopup>,
 * so a non-null `remindAfter` here always means "still snoozed" — no clock read in
 * render.
 */
export function useAmbassadorPopup(): AmbassadorPopupState {
  const mounted = useHasMounted();
  const remindAfter = useAmbassadorPopupStore((s) => s.remindAfter);
  const dismissedForever = useAmbassadorPopupStore((s) => s.dismissedForever);
  const remindLater = useAmbassadorPopupStore((s) => s.remindLater);
  const dismissForever = useAmbassadorPopupStore((s) => s.dismissForever);

  const isDismissed = dismissedForever || remindAfter !== null;

  return { mounted, isDismissed, remindLater, dismissForever };
}

'use client';

import { EyeOff } from 'lucide-react';
import { toast } from 'sonner';

import { useSetWrappedHidden } from './queries';
import { useAuthStore } from '@/lib/stores/authStore';
import { extractApiError } from '@/lib/utils/api-error';
import type { User } from '@/types/auth';
import { SettingsFormGroup } from '@/v2/features/settings/SettingsForm';
import { SettingsToggleRow } from '@/v2/features/settings/SettingsToggleRow';

/**
 * Hide from Wrapped (Arthur's spec, NDPA 2023; the techlead's brief, 4
 * November 2026): a student turns their Lawexa Wrapped off, and the server
 * drops the record (`PUT /api/wrapped/me/visibility`). On the Profile screen
 * for a Law School profile, the only accounts with a Bar Finals Wrapped. The
 * switch shows the asked-for state while it saves, and goes back if it fails.
 */
export function WrappedPrivacyGroup({ user }: { user: User }) {
  const storeHidden = useAuthStore((state) => state.user?.wrapped_hidden);
  const saved = storeHidden ?? user.wrapped_hidden ?? false;
  const setHidden = useSetWrappedHidden();
  const checked = setHidden.isPending && setHidden.variables !== undefined ? setHidden.variables : saved;

  return (
    <SettingsFormGroup id="wrapped-privacy" label="Lawexa Wrapped" description="Your Bar Finals year in cards, seen only by you until you share it.">
      <SettingsToggleRow
        icon={EyeOff}
        label="Hide from Wrapped"
        hint={checked ? 'Your Wrapped is off, and its record is removed.' : 'Turn on to remove your Wrapped and keep it off.'}
        checked={checked}
        disabled={setHidden.isPending}
        onCheckedChange={(next) =>
          setHidden.mutate(next, {
            onSuccess: () => toast.success(next ? 'Wrapped hidden.' : 'Wrapped is back on.'),
            onError: (error) => toast.error(extractApiError(error).message || 'That did not save. Try again.'),
          })
        }
      />
    </SettingsFormGroup>
  );
}

import { VerificationFallback } from '@/v2/features/settings/verification/states';

/**
 * Route-level loading boundary for `/settings/verification`: the same
 * silhouette the screen draws while the profile loads, so the hand-off moves
 * nothing.
 */
export default function VerificationSettingsLoading() {
  return <VerificationFallback />;
}

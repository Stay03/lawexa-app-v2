import { DevicesFallback } from '@/v2/features/settings/devices/states';

/**
 * Route-level loading boundary for `/settings/devices`: the same silhouette the
 * screen draws while its list loads, so the hand-off moves nothing.
 */
export default function DevicesSettingsLoading() {
  return <DevicesFallback />;
}

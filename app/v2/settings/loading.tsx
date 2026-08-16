import { SettingsFallback } from '@/v2/features/settings/SettingsList';

/**
 * Route-level loading boundary for `/settings` — the SAME silhouette the live
 * screen resolves into, drawn in the same column at the same row heights, so
 * the hand-off moves nothing (the bookmarks / radars route convention). It owns
 * its own `aria-hidden` + `inert` and its one `role="status"` announcement, in
 * `SettingsList.tsx`, so this file cannot drift from it.
 */
export default function SettingsLoading() {
  return <SettingsFallback />;
}

import { ProfileFallback } from '@/v2/features/settings/profile/states';

/**
 * Route-level loading boundary for `/settings/profile`: the SAME silhouette
 * the live screen shows while it reads the account, drawn in the same column at
 * the same block heights, so the hand-off moves nothing. It owns its own
 * `aria-hidden` + `inert` and its one `role="status"` announcement, in
 * `states.tsx`, so this file cannot drift from it.
 *
 * No back-link bar is reserved here: the way back lives in the shell's header,
 * which is painted by the shell and is therefore already on screen while this
 * boundary shows. The heading placeholder is `md:` and up for the same reason:
 * below that width the title is in the bar.
 */
export default function ProfileSettingsLoading() {
  return <ProfileFallback />;
}

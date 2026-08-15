import { FolderDetailFallback } from '@/v2/features/folders/detail/FolderScreen';

/**
 * Route-level loading boundary for a single folder.
 *
 * It did not exist, which is why `folders/loading.tsx` had to wear the folder
 * DETAIL's shape — and that segment boundary also wraps `(library)/page.tsx`,
 * so the folder LIST was painting a detail silhouette on the way to itself.
 * Same shape of fault as cases and statutes, same fix: give the detail route
 * the boundary its siblings already had, then the segment above is free to be
 * neutral.
 */
export default function FolderLoading() {
  return <FolderDetailFallback />;
}

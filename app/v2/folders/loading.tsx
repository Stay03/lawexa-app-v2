import { FolderDetailFallback } from '@/v2/features/folders/detail/FolderScreen';

/**
 * The `folders` SEGMENT boundary — the fallback for whatever child is being
 * navigated INTO under `/folders`, and that child is a FOLDER PAGE (the library
 * has its own boundary inside the `(library)` route group).
 *
 * Same reasoning as `app/v2/notes/loading.tsx` and `app/v2/cases/loading.tsx`,
 * which carry the full note: under the v2 rewrite proxy the client cannot
 * prefetch parameterised routes, so this boundary shows on EVERY click from a
 * folder row into the folder for a full server round trip. It must therefore be
 * the FOLDER PAGE's shape — trail, header, stream — so the reader sees that
 * silhouette and then the folder, and the hand-off moves nothing.
 */
export default function FoldersSegmentLoading() {
  return <FolderDetailFallback />;
}

import type { Metadata } from 'next';

import { FolderScreen } from '@/v2/features/folders/detail/FolderScreen';

/**
 * v2 `/folders/[uuid]` — server shell for one folder.
 *
 * PRIVATE surface: the folder endpoint 401s without a token and 404s for
 * another account's private folder, so there is no crawler-visible content and
 * the metadata is a bare generic title + noindex (the radar / conversation
 * precedent). The folder's real NAME is per-user data — it reaches the tab
 * through the client's header context, not through a server fetch that would
 * put a private string in a shared payload and a Laravel round trip in front of
 * every hard load.
 *
 * ── uuid, AND ONLY uuid ─────────────────────────────────────────────────────
 * The slug route 404s, numeric ids 404, sibling folders may share a slug, and a
 * rename rewrites every descendant's `slug_path` — so the uuid v1 already used
 * stays the only honest address and no old link changes meaning.
 */
interface FolderPageProps {
  params: Promise<{ uuid: string }>;
}

export function generateMetadata(): Metadata {
  return {
    title: 'Folder',
    description: 'One of your folders.',
    robots: { index: false, follow: false },
  };
}

/** Same router-cache lever and safety argument as `/folders` above it. */
export const unstable_dynamicStaleTime = 300;

export default async function V2FolderPage({ params }: FolderPageProps) {
  const { uuid } = await params;
  return <FolderScreen uuid={uuid} />;
}

import type { Metadata } from 'next';

import { EditNoteScreen } from '@/v2/features/notes/editor/EditNoteScreen';

/**
 * v2 `/notes/[slug]/edit` — server shell for the note editor.
 *
 * PRIVATE SURFACE (the `/notes/create` argument, with one addition): the title is
 * deliberately generic rather than the note's own. Naming it would mean fetching
 * the note on the server for a page only its author can open, spending a round
 * trip on head content nobody will ever see in a share preview — and putting a
 * private note's title into a payload that exists to be cached. `noindex`, no
 * canonical, no OG card: the public address of a note is `/notes/{slug}`, and
 * that page (Builder A's) owns its metadata.
 */
interface EditNotePageProps {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = {
  title: 'Edit note',
  description: 'Edit your note. Changes save themselves as you type.',
  robots: { index: false, follow: false },
};

/** Same router-cache lever and safety argument as `/notes/create`. */
export const unstable_dynamicStaleTime = 300;

export default async function V2EditNotePage({ params }: EditNotePageProps) {
  // The only await in the body: the route params, which cost no I/O. The note is
  // a client query — it is per-reader and ownership-gated, so it must never be
  // server-rendered into a shared payload.
  const { slug } = await params;

  return <EditNoteScreen slug={slug} />;
}

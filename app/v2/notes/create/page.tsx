import type { Metadata } from 'next';

import { CreateNoteScreen } from '@/v2/features/notes/editor/CreateNoteScreen';

/**
 * v2 `/notes/create` — server shell for the note editor.
 *
 * PRIVATE SURFACE, so it follows the conversations/radars precedent rather than
 * the case-page one: a bare title, `noindex`, and no canonical or OG card. There
 * is nothing here to share — the note does not exist yet — and a share card for
 * an empty editor would be a link to somebody else's blank page.
 *
 * The segment awaits nothing. Who may write is decided from the session snapshot
 * the v2 layout already published, and the note itself is created by the first
 * keystroke, not by this render.
 */
export const metadata: Metadata = {
  title: 'New note',
  description: 'Write a note. It saves itself as you type.',
  robots: { index: false, follow: false },
};

/**
 * Keep this segment in the client Router Cache for five minutes — the same lever
 * and the same safety argument as `/radars/new`. The payload is this route's
 * metadata and nothing else; every byte the reader sees comes from their own
 * session-scoped client queries.
 */
export const unstable_dynamicStaleTime = 300;

export default function V2CreateNotePage() {
  return <CreateNoteScreen />;
}

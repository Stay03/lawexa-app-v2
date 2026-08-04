'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useV2Session } from '@/v2/runtime/session-context';
import { NoteEditorScreen } from './NoteEditorScreen';
import {
  NOTE_PAPER_COLUMN,
  NoteEditorGuestState,
  NoteEditorSignedOutState,
} from './states';

/**
 * CreateNoteScreen — `/notes/create`.
 *
 * ── THE GATE IS SYNCHRONOUS ─────────────────────────────────────────────────
 * `useV2Session()` reads a snapshot the SERVER already resolved before this tree
 * mounted, so who may write is known on the first frame: no skeleton, no flash
 * of an editor a guest cannot use, and no redirect. Two refusals, two different
 * answers — signed out means "sign in", because the door opens once you do; a
 * guest (view-only pre-registration, the standing product boundary) means
 * "create an account", because registering IS the door.
 *
 * ── NOTHING IS CREATED HERE ─────────────────────────────────────────────────
 * Opening this page writes nothing. The note comes into existence on the FIRST
 * CHANGE, and until then there is no row, no slug and no draft in anyone's list
 * — which is why arriving and leaving again costs the reader nothing and leaves
 * no empty note behind. See `autosave-machine.ts`.
 *
 * ── THE URL-MISMATCH GUARD (and the duplicate note it prevents) ─────────────
 * After the first save this screen rewrites the URL to `/notes/{slug}/edit`
 * QUIETLY — no navigation, so the editor is never torn down mid-sentence (see
 * `quietReplaceUrlPath`). The trade is that the history entry still carries
 * Next's tree for `/notes/create`, so a Back/Forward that lands back on it
 * restores THIS route under the edit URL.
 *
 * Left alone that is not merely cosmetic: this screen would mount with no
 * record, the mirror row has already been re-keyed onto the note id so the
 * restore path finds nothing to offer, and the first keystroke would create a
 * SECOND note — with the pathname guard on the quiet rewrite then declining to
 * move the URL again, so the duplicate would be invisible until it turned up in
 * the list. The effect below closes that: when the URL names a route this is
 * not, it hands off to the route the URL actually names. `router.replace` is
 * correct rather than heavy here — there is nothing to preserve, because the
 * note is already saved and this instance is a restored ghost of the screen
 * that saved it.
 */
export function CreateNoteScreen() {
  const { signedIn, role } = useV2Session();
  const router = useRouter();

  useEffect(() => {
    // Reads `window.location` rather than `usePathname()` on purpose: the quiet
    // rewrite never told the App Router, so the router's idea of the path is
    // exactly the stale one this guard exists to detect.
    if (window.location.pathname === '/notes/create') return;
    router.replace(window.location.pathname);
  }, [router]);

  if (!signedIn) {
    return (
      <div className={NOTE_PAPER_COLUMN}>
        <NoteEditorSignedOutState />
      </div>
    );
  }

  if (role === 'guest') {
    return (
      <div className={NOTE_PAPER_COLUMN}>
        <NoteEditorGuestState />
      </div>
    );
  }

  return <NoteEditorScreen initialRecord={null} />;
}

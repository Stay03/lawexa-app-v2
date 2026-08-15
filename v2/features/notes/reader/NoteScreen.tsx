'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { useV2Session } from '@/v2/runtime/session-context';
import {
  clearScreenContext,
  setScreenContext,
  type ScreenBack,
} from '@/v2/shell/screen-context';
import { notesQueries } from '../queries';
import { NoteDocument } from './NoteDocument';
import {
  NOTE_COLUMN,
  NoteDocumentSkeleton,
  NoteErrorState,
  NoteNotFoundState,
  NoteSignedOutState,
  NoteUnavailableState,
  isNoteUnavailable,
} from './states';

/**
 * NoteScreen — the `/notes/[slug]` client root.
 *
 * The server shell above it owns the page title; everything a reader sees is
 * here, on a client query that carries their session — which is what makes the
 * bookmark star, the draft mark and the Edit affordance correct per viewer. A
 * note read is per-reader by nature (a draft is visible to exactly one
 * account), so nothing about it may be server-rendered into a shared payload.
 *
 * ── WHO CAN READ THIS (measured against production, August 4 2026) ──────────
 * `GET /api/notes/{slug}` answers **401 without a bearer token** — unlike
 * `GET /api/cases/{slug}`, which is public and answers 404 for an unknown
 * slug. So the query is gated on the session and a visitor with no session at
 * all gets the designed sign-in state instead of a network error; a guest
 * holds a real token and reads normally.
 *
 * ── THE FIVE OUTCOMES, EACH WITH ITS OWN ANSWER ─────────────────────────────
 *   signed out            the sign-in state (the query never runs)
 *   403 / 404             not found — see `isNoteUnavailable` for why a
 *                         refusal and an absence get the SAME answer
 *   any other failure     the error state, with a retry that can succeed
 *   locked body           "not available" — `has_access: false`, or a payload
 *                         whose `content` is not a string (the locked paid
 *                         note omits the key entirely). No price, no
 *                         purchase: v2 does not sell notes (owner 1)
 *   otherwise             the document
 */
export function NoteScreen({ slug }: { slug: string }) {
  const { signedIn, userId } = useV2Session();
  const pathname = usePathname() ?? '';

  const query = useQuery({
    ...notesQueries.detail({ slug, viewerId: userId }),
    enabled: signedIn,
  });
  const note = query.data?.data ?? null;

  /**
   * THE BAR CARRIES NO TITLE HERE (phase 7): the note is a document and its
   * masthead — author, updated, the name in the reading serif, the draft mark —
   * is its title. What the bar DOES need from this screen is the way back,
   * because the address cannot know it.
   *
   * THE WAY BACK KEEPS THE TAB (review F9). A reader who opened one of their
   * own notes came from My notes, often from a list that exists nowhere else
   * since a draft appears on no other surface, and returning them to All notes
   * loses the place AND shows a stream their note is not in. Derived from
   * OWNERSHIP against the server-verified session id, so it is stateless,
   * correct on a cold deep link, and cannot go stale.
   *
   * `null` until the note lands, which leaves the route default (`/notes`)
   * standing: a back control that works from the first frame and sharpens, never
   * one that is missing while a request is in flight.
   */
  const own = note !== null && userId !== null && userId === note.user?.id;
  useEffect(() => {
    const back: ScreenBack | null = own
      ? { href: '/notes?tab=mine', label: 'Back to your notes' }
      : null;
    setScreenContext({ pathname, back, actions: [] });
  }, [pathname, own]);
  useEffect(() => () => clearScreenContext(), []);

  if (!signedIn) {
    return (
      <div className={NOTE_COLUMN}>
        <NoteSignedOutState />
      </div>
    );
  }

  if (query.isPending) {
    return (
      <div className={NOTE_COLUMN}>
        <NoteDocumentSkeleton />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className={NOTE_COLUMN}>
        {isNoteUnavailable(query.error) ? (
          <NoteNotFoundState />
        ) : (
          <NoteErrorState onRetry={() => void query.refetch()} />
        )}
      </div>
    );
  }

  if (!note) {
    return (
      <div className={NOTE_COLUMN}>
        <NoteNotFoundState />
      </div>
    );
  }

  // A readable note always carries a `content` STRING (empty for a note with
  // nothing in it yet, which the document handles as its own quiet state).
  // A body the viewer may not have is signalled by `has_access: false`, and
  // the locked payload OMITS the `content` key entirely — not `null`, as this
  // gate originally assumed (probed on prod, Aug 4 2026). Both tests, so a
  // payload that drops `has_access` someday still cannot render a bodyless
  // document.
  if (note.has_access === false || typeof note.content !== 'string') {
    return (
      <div className={NOTE_COLUMN}>
        <NoteUnavailableState />
      </div>
    );
  }

  // OWNERSHIP (`own`, above) is decided against the SERVER-VERIFIED session id —
  // not against a client store, and not against the author's name. Not a
  // security boundary either: the editor route and every save the API accepts
  // have their own gates. It decides whether the Edit link is DRAWN, and a link
  // that leads only to a refusal should not be. The same answer chooses the
  // bar's way back, so the two can never disagree about whose note this is.
  const editHref = own ? `/notes/${note.slug}/edit` : null;

  return (
    // `.v2-note-doc` scopes the reading typography (note-document.css).
    <div className={`v2-note-doc ${NOTE_COLUMN}`}>
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        <NoteDocument note={note} editHref={editHref} />
      </div>
    </div>
  );
}

/**
 * The route fallback — identical to what `app/v2/notes/loading.tsx` renders,
 * so segment boundary → live document is one continuous shape and nothing
 * moves at the hand-off.
 */
export function NoteFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading note
      </span>
      {/* `aria-hidden` + `inert` per standards §8ii: a route fallback is
          DELETED, not reconciled, when content arrives, so anything focusable
          in here would lose focus mid-interaction. */}
      <div aria-hidden inert className={NOTE_COLUMN}>
        <NoteDocumentSkeleton />
      </div>
    </>
  );
}

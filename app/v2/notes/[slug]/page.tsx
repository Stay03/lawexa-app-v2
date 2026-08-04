import type { Metadata } from 'next';

import { NoteScreen } from '@/v2/features/notes/reader/NoteScreen';

/**
 * v2 `/notes/[slug]` — server shell.
 *
 * ── NO METADATA FETCH, AND THE MEASUREMENT THAT DECIDED IT ──────────────────
 * The case page fetches its subject here so a pasted link unfurls into a real
 * card. That is only possible because `GET /api/cases/{slug}` is PUBLIC.
 * Probed against production on August 4 2026:
 *
 *     GET /api/notes/{slug}   → 401 {"message":"Unauthenticated."}
 *     GET /api/cases/{slug}   → 404 {"message":"Resource not found."}
 *
 * A note read requires a bearer token. `generateMetadata` runs for crawlers
 * and link-preview bots, which carry none — so a fetch here could only ever
 * succeed for a signed-in reader, i.e. exactly the audience that does not need
 * a preview card, while every share would still unfurl as nothing. Fetching a
 * note per metadata render to serve that case would be a round trip bought for
 * no one.
 *
 * So this route ships the honest minimum: a static title and description, and
 * `robots: noindex, nofollow` because an indexed note URL resolves to a
 * sign-in wall for the crawler. No canonical and no OG card — both would
 * advertise a page a stranger cannot open. The note's REAL name still reaches
 * the shell header, from the client query, the moment it resolves.
 *
 * BACKEND-ASK CANDIDATE (recorded, not assumed): if `GET /api/notes/{slug}`
 * ever answers unauthenticated for a PUBLISHED FREE note, this file becomes
 * the cases treatment — `generateMetadata` fetching the note for a real title,
 * description, canonical and share card — in one edit.
 */
interface NotePageProps {
  params: Promise<{ slug: string }>;
}

export function generateMetadata(): Metadata {
  return {
    title: 'Note',
    description: 'Read a note on Lawexa.',
    robots: { index: false, follow: false },
  };
}

/**
 * KEEP THIS PAGE IN THE CLIENT ROUTER CACHE FOR 5 MINUTES. Same lever and same
 * safety argument as `app/v2/cases/[slug]/page.tsx`, which carries the full
 * note. This segment awaits only its route params — it performs no I/O at all
 * — so a re-used payload cannot show anyone stale note data; the note a reader
 * SEES comes from the client query, which carries their session and therefore
 * their bookmark state, their draft visibility and their Edit affordance.
 */
export const unstable_dynamicStaleTime = 300;

export default async function V2NotePage({ params }: NotePageProps) {
  // The only await in the body: the route params, which cost no I/O. The note
  // itself is a client query — it is per-reader (a draft is visible to exactly
  // one account), so it must not be server-rendered into a shared payload.
  const { slug } = await params;

  return <NoteScreen slug={slug} />;
}

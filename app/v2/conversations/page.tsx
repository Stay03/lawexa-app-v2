import type { Metadata } from 'next';
import { ConversationsScreen } from '@/v2/features/conversations/list/ConversationsScreen';

/**
 * v2 `/conversations` — server shell. Follows the v2 metadata convention
 * (app/v2/layout.tsx docblock): a server `page.tsx` exporting `generateMetadata`
 * that renders a `'use client'` child (client modules cannot export metadata).
 *
 * This is a PRIVATE, authenticated list of the user's own conversations — unlike
 * the public `/c/[id]` share pages, there is nothing here for a crawler to index,
 * so metadata is deliberately minimal and honest: a bare `title` ("Conversations"
 * → the root "%s | Lawexa" template appends the brand) + a description, and
 * `robots: { index: false, follow: false }` so a private surface never invites
 * indexing. No canonical / OG share card is emitted (that would advertise a page
 * that resolves to a sign-in wall).
 *
 * This segment awaits NOTHING. It used to open with `await verifySession()` just
 * to compute the `signedIn` flag, which cost an uncached `/auth/me` round trip on
 * every navigation here (React `cache()` dedupes only within one server render,
 * and a soft navigation re-renders this page without re-rendering the layout) —
 * so `loading.tsx` covered a wait on Laravel every time. The route is still
 * dynamic, so `loading.tsx` still appears for one I/O-free Next round trip; the
 * wait is shortened, not removed.
 * The screen now reads the same server-verified flag from `<V2SessionProvider>`,
 * which the layout published from its own single `/auth/me` call. Guests are
 * unchanged: `signedIn` is still `!!session`, so a stale or revoked token still
 * resolves to the signed-out state, never a perpetually-gated skeleton.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Conversations',
    description: 'Browse and search your Lawexa AI conversations.',
    robots: { index: false, follow: false },
  };
}

export default function V2ConversationsPage() {
  return <ConversationsScreen />;
}

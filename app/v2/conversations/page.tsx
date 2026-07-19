import type { Metadata } from 'next';
import { verifySession } from '@/v2/runtime/session';
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
 * `verifySession()` is React-cached, so this shares the single `/auth/me` round
 * trip with the layout; the signed-in flag is threaded to the client screen so a
 * guest gets the sign-in state instead of a perpetually-gated skeleton.
 */
export function generateMetadata(): Metadata {
  return {
    title: 'Conversations',
    description: 'Browse and search your Lawexa AI conversations.',
    robots: { index: false, follow: false },
  };
}

export default async function V2ConversationsPage() {
  const session = await verifySession();
  return <ConversationsScreen signedIn={!!session} />;
}

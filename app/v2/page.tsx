import { verifySession } from '@/v2/runtime/session';
import { V2Home } from './home';

/**
 * v2 home (server shell). Resolves the server-verified session so the greeting
 * can show the signed-in first name when present, then renders the `'use client'`
 * home surface. UI-only this wave; the composer and chips are non-functional.
 *
 * The `V2-HOME` curl marker lives on the client home's root (`data-v2-marker`),
 * which server-renders into the initial HTML.
 */
export default async function V2HomePage() {
  const session = await verifySession();
  const firstName = session?.user.name?.trim().split(/\s+/)[0];

  return <V2Home name={firstName} signedIn={!!session} />;
}

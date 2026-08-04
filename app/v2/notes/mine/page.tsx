import { redirect } from 'next/navigation';

/**
 * v1's `/notes/mine` page, retired into the library's My notes tab.
 *
 * The v2 manifest claims `/notes/*`, so this path reaches the v2 tree and must
 * answer for itself. It has no screen of its own: "my notes" is one of two
 * streams on `/notes`, and shipping a second list implementation for the same
 * rows is exactly the drift v2 exists to stop.
 *
 * TEMPORARY (307), NOT PERMANENT (308), and that is a deliberate choice rather
 * than caution. A permanent redirect is cached by the browser essentially
 * forever, per-origin — and the v2 experience is an OPT-IN behind a cookie
 * that can be switched back off. A reader who visits `/notes/mine` in v2 and
 * later returns to v1 would find their browser still rewriting the URL to a
 * page v1 does not have, from a cache we cannot reach. The redirect becomes
 * permanent at cutover, when there is no v1 left to break.
 *
 * The destination is the CLEAN path (`/notes?tab=mine`), never a `/v2`-prefixed
 * one: the proxy owns that rewrite, and a v2-prefixed URL in the address bar
 * is a leak of the migration into the product.
 */
export default function V2MyNotesPage(): never {
  redirect('/notes?tab=mine');
}

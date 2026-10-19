/**
 * Whether the session belongs to a real account, not a guest pass or a crawler.
 *
 * A visitor who is not signed in holds a guest pass (`guest-pass.tsx`), so the
 * published session says `signedIn` for them too: they READ as anyone does.
 * What belongs to an account (chats, the notification bell, a plan, sending a
 * message) asks this instead, the same line v1 draws with `isGuest`.
 */
export function isAccountRole(role: string | null | undefined): boolean {
  return !!role && role !== 'guest' && role !== 'bot';
}

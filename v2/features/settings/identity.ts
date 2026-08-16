/**
 * settings/identity: the tiny pure helpers the settings surfaces share about
 * the person signed in.
 *
 * It exists so the account card on the index and the profile screen behind it
 * cannot draw two different sets of initials for one name.
 */

/** Up-to-two-letter initials from a display name (falls back to "?"). */
export function initialsOf(name: string | null): string {
  const initials = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return initials || '?';
}

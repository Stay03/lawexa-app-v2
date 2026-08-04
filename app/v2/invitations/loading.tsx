import { InvitationsFallback } from '@/v2/features/invitations/InvitationsScreen';

/**
 * Route-level loading boundary for `/invitations`. It renders the SAME
 * component the screen exports, so route boundary → live inbox is one
 * continuous shape and nothing moves at the hand-off. The fallback owns its
 * `aria-hidden` + `inert` and its still (unpulsed) skeleton itself, so this
 * file cannot drift from it.
 */
export default function InvitationsLoading() {
  return <InvitationsFallback />;
}

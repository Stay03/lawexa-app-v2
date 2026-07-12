import { SpacesGuard } from '@/components/auth/SpacesGuard';

/**
 * Gates the Spaces feature to its soft-launch audience (researcher / admin /
 * superadmin). Everyone else is redirected home by SpacesGuard.
 */
export default function SpacesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SpacesGuard>{children}</SpacesGuard>;
}

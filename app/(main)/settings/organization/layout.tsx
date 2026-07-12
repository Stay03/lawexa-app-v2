import { SpacesGuard } from '@/components/auth/SpacesGuard';

/** Gates the organization settings page to the Spaces soft-launch audience. */
export default function OrganizationSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SpacesGuard>{children}</SpacesGuard>;
}

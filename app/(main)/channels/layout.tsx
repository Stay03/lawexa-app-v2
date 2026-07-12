import { SpacesGuard } from '@/components/auth/SpacesGuard';

/** Gates channel routes to the Spaces soft-launch audience. */
export default function ChannelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SpacesGuard>{children}</SpacesGuard>;
}

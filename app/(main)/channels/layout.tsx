import { SpacesGuard } from '@/components/auth/SpacesGuard';
import { RouteTransition } from '@/components/collab/RouteTransition';

/** Gates channel routes to the Spaces soft-launch audience. */
export default function ChannelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SpacesGuard>
      <RouteTransition className="flex min-h-0 flex-1 flex-col">
        {children}
      </RouteTransition>
    </SpacesGuard>
  );
}

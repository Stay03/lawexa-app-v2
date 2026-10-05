import type { Metadata } from 'next';
import { NotificationResolver } from '@/v2/features/notifications/NotificationResolver';

/**
 * v2 `/notifications/{id}` — server shell for the resolver: mark the row read,
 * then send the reader to where it points (`NotificationResolver` carries the
 * full account, including why this is not a detail page).
 *
 * Private and noindex, with nothing fetched on the server: the row is
 * per-account, and the next screen is somewhere else.
 */
interface NotificationPageProps {
  params: Promise<{ id: string }>;
}

export function generateMetadata(): Metadata {
  return {
    title: 'Notification',
    description: 'Opening a notification.',
    robots: { index: false, follow: false },
  };
}

export default async function V2NotificationPage({ params }: NotificationPageProps) {
  const { id } = await params;
  return <NotificationResolver id={id} />;
}

import type { Metadata } from 'next';
import { RequestScreen } from '@/v2/features/settings/requests/RequestScreen';

/**
 * v2 `/content-requests/{uuid}`: one request. The address the "request
 * received" and "request fulfilled" emails link to, so it stays v1's.
 * Private and noindex, with nothing fetched on the server: the request is the
 * account's own, read by a client query.
 */
interface RequestPageProps {
  params: Promise<{ uuid: string }>;
}

export function generateMetadata(): Metadata {
  return {
    title: 'Request',
    description: 'One of your requests, and where it stands.',
    robots: { index: false, follow: false },
  };
}

export default async function V2RequestPage({ params }: RequestPageProps) {
  const { uuid } = await params;
  return <RequestScreen uuid={uuid} />;
}

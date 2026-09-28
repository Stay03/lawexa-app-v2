import { MessagePacksFallback } from '@/v2/features/settings/message-packs/states';

/**
 * Route-level loading boundary for `/settings/message-packs`: the same
 * silhouette the screen draws while it reads, so the hand-off moves nothing.
 */
export default function MessagePacksLoading() {
  return <MessagePacksFallback />;
}

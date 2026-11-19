import { ItemsPageFallback } from '@/v2/features/private-items/states';

/** Route-level loading boundary for `/settings/templates`: the screen's own silhouette. */
export default function MyTemplatesLoading() {
  return <ItemsPageFallback label="Loading your templates" />;
}

import { ItemsPageFallback } from '@/v2/features/private-items/states';

/** Route-level loading boundary for `/settings/skills`: the screen's own silhouette. */
export default function MySkillsLoading() {
  return <ItemsPageFallback label="Loading your skills" />;
}

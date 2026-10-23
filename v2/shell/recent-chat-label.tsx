import { Blocks } from 'lucide-react';

export { recentSpaceName } from './recent-chat-space';

/**
 * A recent chat's label in the sidebar and the drawer: its title, and under it
 * the space (recent-chat-space.ts), the way a row on the chats list page draws
 * it (the Blocks mark, small and muted). A screen reader hears "title, in
 * space", as the list row's label says it.
 */
export function RecentChatLabel({ title, spaceName }: { title: string; spaceName: string | null }) {
  if (!spaceName) return <span className="truncate">{title}</span>;
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate leading-5">{title}</span>
      <span className="flex min-w-0 items-center gap-1 text-xs leading-4 text-muted-foreground">
        <Blocks aria-hidden className="size-3! shrink-0" />
        <span className="sr-only">, in </span>
        <span className="truncate">{spaceName}</span>
      </span>
    </span>
  );
}

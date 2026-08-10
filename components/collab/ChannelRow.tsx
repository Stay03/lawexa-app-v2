import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { channelVisibilityFace } from '@/lib/collab/visibility';
import { cn } from '@/lib/utils';
import type { Channel } from '@/types/collab';

interface ChannelRowProps {
  channel: Channel;
}

/** A channel row within a space — links through to the message reader. */
export function ChannelRow({ channel }: ChannelRowProps) {
  const visibilityFace = channelVisibilityFace(channel.visibility);
  const Icon = visibilityFace.icon;
  const hasUnread = (channel.unread_count ?? 0) > 0;

  return (
    <Link
      href={`/channels/${channel.uuid}`}
      className={cn(
        'group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors',
        'hover:border-primary/30 hover:bg-muted/30'
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'truncate',
              hasUnread ? 'font-semibold text-foreground' : 'font-medium'
            )}
          >
            {channel.name}
          </span>
        </div>
        {channel.description && (
          <p className="truncate text-xs text-muted-foreground">
            {channel.description}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {channel.active_members_count}
        </span>
        <span className="hidden sm:inline">
          {channel.last_message_at
            ? formatDistanceToNow(new Date(channel.last_message_at), {
                addSuffix: true,
              })
            : 'No messages yet'}
        </span>
        {hasUnread && (
          <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 tabular-nums">
            {channel.unread_count}
          </Badge>
        )}
      </div>
    </Link>
  );
}

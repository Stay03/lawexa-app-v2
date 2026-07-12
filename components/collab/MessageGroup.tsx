import { cn } from '@/lib/utils';
import { formatFullTimestamp, formatMessageTime } from '@/lib/utils/collab';
import type { Message, SlimUser } from '@/types/collab';

import { MemberAvatar } from './MemberAvatar';
import { MessageRow } from './MessageRow';

export interface MessageGroupData {
  key: string;
  author: SlimUser | null;
  messages: Message[];
}

interface MessageGroupProps {
  group: MessageGroupData;
  /** Per-message permissions, resolved by the conversation. */
  permissionsFor: (message: Message) => { canEdit: boolean; canDelete: boolean };
  onSaveEdit: (messageUuid: string, content: string) => Promise<void>;
  onDelete: (messageUuid: string) => void;
}

/** A run of consecutive messages from one author, sharing an avatar + header. */
export function MessageGroup({
  group,
  permissionsFor,
  onSaveEdit,
  onDelete,
}: MessageGroupProps) {
  const authorName = group.author?.name ?? 'Deleted user';
  const first = group.messages[0];

  return (
    <div className="flex gap-3 px-1">
      <MemberAvatar user={group.author} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'text-sm font-semibold',
              !group.author && 'text-muted-foreground'
            )}
          >
            {authorName}
          </span>
          <span
            className="text-xs text-muted-foreground"
            title={formatFullTimestamp(first.created_at)}
          >
            {formatMessageTime(first.created_at)}
          </span>
        </div>
        <div className="mt-0.5">
          {group.messages.map((message) => {
            const { canEdit, canDelete } = permissionsFor(message);
            return (
              <MessageRow
                key={message.uuid}
                message={message}
                canEdit={canEdit}
                canDelete={canDelete}
                onSaveEdit={onSaveEdit}
                onDelete={onDelete}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

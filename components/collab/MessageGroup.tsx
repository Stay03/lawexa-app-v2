import { Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatFullTimestamp, formatMessageTime } from '@/lib/utils/collab';
import type { Message, SlimUser } from '@/types/collab';

import { LawexaAvatar } from './LawexaAvatar';
import { MemberAvatar } from './MemberAvatar';
import { MessageRow } from './MessageRow';

export interface MessageGroupData {
  key: string;
  author: SlimUser | null;
  /** True for a run of Lawexa (`is_ai`) replies; never merges with humans. */
  isAi: boolean;
  messages: Message[];
}

interface MessageGroupProps {
  group: MessageGroupData;
  /** Per-message permissions, resolved by the conversation. */
  permissionsFor: (message: Message) => { canEdit: boolean; canDelete: boolean };
  /**
   * Per-message entry/reveal animation flags, resolved by the conversation
   * from its newest-message baseline (only genuinely-new tail messages animate).
   */
  animationFor: (message: Message) => {
    animateEntry: boolean;
    animateReveal: boolean;
  };
  onSaveEdit: (messageUuid: string, content: string) => Promise<void>;
  onDelete: (messageUuid: string) => void;
}

/** A run of consecutive messages from one author, sharing an avatar + header. */
export function MessageGroup({
  group,
  permissionsFor,
  animationFor,
  onSaveEdit,
  onDelete,
}: MessageGroupProps) {
  const authorName = group.isAi
    ? 'Lawexa'
    : group.author?.name ?? 'Deleted user';
  const first = group.messages[0];

  return (
    <div className="flex gap-3 px-1">
      {group.isAi ? (
        <LawexaAvatar className="mt-0.5 shrink-0" />
      ) : (
        <MemberAvatar user={group.author} className="mt-0.5 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'text-sm font-semibold',
              !group.isAi && !group.author && 'text-muted-foreground'
            )}
          >
            {authorName}
          </span>
          {group.isAi && (
            <Badge
              variant="secondary"
              className="h-4 gap-0.5 px-1.5 text-[10px] font-medium [&>svg]:size-2.5!"
            >
              <Sparkles />
              AI
            </Badge>
          )}
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
            const { animateEntry, animateReveal } = animationFor(message);
            return (
              <MessageRow
                key={message.uuid}
                message={message}
                canEdit={canEdit}
                canDelete={canDelete}
                animateEntry={animateEntry}
                animateReveal={animateReveal}
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

'use client';

import { cn } from '@/lib/utils';
import type { SlimUser } from '@/types/collab';

import { LawexaAvatar } from '../LawexaAvatar';
import { MemberAvatar } from '../MemberAvatar';

interface ListCreatorLabelProps {
  /** Lawexa authored it — takes precedence over `creator`. */
  isAi: boolean;
  /** The human author, or null (Lawexa OR a deleted account). */
  creator: SlimUser | null;
  /** Avatar size, forwarded to the underlying avatar. */
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

/**
 * Renders the identity behind a list or item: Lawexa (Sparkles mark + "Lawexa")
 * when `isAi`, otherwise the member's avatar + name. A `null` creator that is
 * NOT Lawexa is a removed account — shown neutrally as "Unknown", never as
 * Lawexa (the contract's identity rule: key on `is_ai`, not `creator === null`).
 */
export function ListCreatorLabel({
  isAi,
  creator,
  size = 'sm',
  className,
}: ListCreatorLabelProps) {
  const name = isAi ? 'Lawexa' : (creator?.name ?? 'Unknown');

  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground',
        className
      )}
    >
      {isAi ? (
        <LawexaAvatar size={size} />
      ) : (
        <MemberAvatar user={creator} size={size} />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}

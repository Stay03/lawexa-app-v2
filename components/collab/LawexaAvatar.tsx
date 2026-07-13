import { Sparkles } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface LawexaAvatarProps {
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

/** Branded avatar for Lawexa (AI) message groups — a Sparkles mark on a tinted
 *  fill, matching the {@link MemberAvatar} size/className shape. */
export function LawexaAvatar({ size = 'default', className }: LawexaAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback className="bg-primary/10 text-primary">
        <Sparkles className="size-4" />
      </AvatarFallback>
    </Avatar>
  );
}

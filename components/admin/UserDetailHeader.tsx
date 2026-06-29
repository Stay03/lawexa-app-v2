'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Ban,
  Check,
  CheckCircle2,
  Copy,
  GraduationCap,
  Mail,
  MapPin,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { AdminUserDetail } from '@/types/admin';
import { cn } from '@/lib/utils';

interface UserDetailHeaderProps {
  user: AdminUserDetail;
  onToggleBlock: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The one primary moderation action — block / unblock the user's free AI messages. */
function BlockButton({
  blocked,
  onToggle,
  className,
}: {
  blocked: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onToggle}
      className={cn(
        'gap-1.5',
        blocked
          ? 'text-emerald-600 hover:text-emerald-600'
          : 'text-destructive hover:text-destructive',
        className
      )}
    >
      {blocked ? (
        <ShieldCheck className="h-3.5 w-3.5" />
      ) : (
        <Ban className="h-3.5 w-3.5" />
      )}
      {blocked ? 'Unblock messages' : 'Block messages'}
    </Button>
  );
}

/**
 * Identity header for the admin User Details page. Surfaces "whose page is
 * this?" — avatar, name, role/verification badges, email, a copyable UUID, and
 * key profile facts — plus the one primary moderation action. Mobile-first: a
 * vertical flow with a full-width action, condensing to a single row on sm+.
 */
export function UserDetailHeader({ user, onToggleBlock }: UserDetailHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(user.uuid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const profile = user.profile;
  const location = [profile?.city, profile?.country].filter(Boolean).join(', ');
  const shortUuid = `${user.uuid.slice(0, 8)}…${user.uuid.slice(-8)}`;

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-4">
        <Avatar className="h-14 w-14 shrink-0">
          <AvatarImage src={user.avatar_url ?? undefined} alt={user.name} />
          <AvatarFallback className="rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
            {user.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge
              variant={
                user.role === 'admin' || user.role === 'superadmin'
                  ? 'default'
                  : 'secondary'
              }
              className="capitalize"
            >
              {user.role}
            </Badge>
            {user.is_verified ? (
              <Badge
                variant="outline"
                className="gap-1 border-green-600 text-green-600"
              >
                <CheckCircle2 className="h-3 w-3" /> Verified
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 border-amber-600 text-amber-600"
              >
                <XCircle className="h-3 w-3" /> Unverified
              </Badge>
            )}
            {user.is_creator && <Badge variant="outline">Creator</Badge>}
            {user.free_messages_blocked && (
              <Badge
                variant="outline"
                className="gap-1 border-red-600 text-red-600"
              >
                <Ban className="h-3 w-3" /> Blocked
              </Badge>
            )}
          </div>
        </div>

        {/* Desktop: action sits top-right */}
        <BlockButton
          blocked={user.free_messages_blocked}
          onToggle={onToggleBlock}
          className="hidden shrink-0 sm:inline-flex"
        />
      </div>

      {/* Meta — clean labelled rows */}
      <div className="mt-4 space-y-2.5 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Mail className="h-4 w-4 shrink-0" />
          <span className="truncate">{user.email}</span>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {copied ? (
                <Check className="h-4 w-4 shrink-0 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 shrink-0" />
              )}
              {shortUuid}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Click to copy UUID</p>
          </TooltipContent>
        </Tooltip>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-muted-foreground">
          {profile?.profession && (
            <span className="flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4 shrink-0" />
              <span className="capitalize">{profile.profession}</span>
            </span>
          )}
          {location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0" />
              {location}
            </span>
          )}
          {user.auth_provider && (
            <span className="capitalize">{user.auth_provider}</span>
          )}
          <span>Member since {format(new Date(user.created_at), 'PP')}</span>
        </div>
      </div>

      {/* Mobile: action is a full-width button at the foot */}
      <BlockButton
        blocked={user.free_messages_blocked}
        onToggle={onToggleBlock}
        className="mt-4 w-full sm:hidden"
      />
    </section>
  );
}

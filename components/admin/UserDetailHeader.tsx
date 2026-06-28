'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CheckCircle2,
  XCircle,
  Ban,
  ShieldCheck,
  Copy,
  Check,
  Mail,
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

/**
 * Horizontal identity header for the admin User Details page. Surfaces the
 * answer to "whose page is this?" — name, role/verification badges, email, a
 * copyable UUID, and key profile facts — plus the one primary moderation action.
 * Deeper profile data lives in the Profile tab; secondary nav lives on the tab bar.
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

  const facts: { text: string; muted?: boolean; capitalize?: boolean }[] = [];
  if (profile?.profession)
    facts.push({ text: profile.profession, capitalize: true });
  if (location) facts.push({ text: location });
  if (user.auth_provider)
    facts.push({ text: user.auth_provider, muted: true, capitalize: true });
  facts.push({
    text: `Member since ${format(new Date(user.created_at), 'PP')}`,
    muted: true,
  });

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-start gap-4">
        {/* Avatar */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
          {initials(user.name)}
        </div>

        {/* Identity */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{user.name}</h1>
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
                className="gap-1 text-green-600 border-green-600"
              >
                <CheckCircle2 className="h-3 w-3" /> Verified
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 text-amber-600 border-amber-600"
              >
                <XCircle className="h-3 w-3" /> Unverified
              </Badge>
            )}
            {user.is_creator && <Badge variant="outline">Creator</Badge>}
            {user.free_messages_blocked && (
              <Badge
                variant="outline"
                className="gap-1 text-red-600 border-red-600"
              >
                <Ban className="h-3 w-3" /> Blocked
              </Badge>
            )}
          </div>

          {/* Email + UUID */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{user.email}</span>
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 font-mono text-xs transition-colors hover:text-foreground"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {shortUuid}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Click to copy UUID</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Facts */}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {facts.map((fact, i) => (
              <span key={fact.text} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="text-muted-foreground/40" aria-hidden>
                    ·
                  </span>
                )}
                <span
                  className={cn(
                    fact.muted && 'text-muted-foreground',
                    fact.capitalize && 'capitalize'
                  )}
                >
                  {fact.text}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Primary action */}
        <div className="flex items-center gap-2">
          {user.free_messages_blocked ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-emerald-600 hover:text-emerald-600"
              onClick={onToggleBlock}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Unblock messages
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={onToggleBlock}
            >
              <Ban className="h-3.5 w-3.5" />
              Block messages
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MemberAvatar } from './MemberAvatar';
import type { SlimUser } from '@/types/collab';

interface InvitationCardProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  roleLabel: string;
  invitedBy: SlimUser | null;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
}

/** A single pending invitation with accept / decline actions. */
export function InvitationCard({
  icon: Icon,
  title,
  subtitle,
  roleLabel,
  invitedBy,
  onAccept,
  onDecline,
}: InvitationCardProps) {
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);

  const run = async (action: 'accept' | 'decline', fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(action);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-muted p-2.5 text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{title}</h3>
          {subtitle && (
            <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            <span className="capitalize">Invited as {roleLabel}</span>
            {invitedBy && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  by
                  <MemberAvatar user={invitedBy} size="sm" className="h-4 w-4" />
                  {invitedBy.name}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => run('decline', onDecline)}
          disabled={busy !== null}
        >
          {busy === 'decline' && <Loader2 className="h-4 w-4 animate-spin" />}
          Decline
        </Button>
        <Button
          size="sm"
          onClick={() => run('accept', onAccept)}
          disabled={busy !== null}
        >
          {busy === 'accept' && <Loader2 className="h-4 w-4 animate-spin" />}
          Accept
        </Button>
      </div>
    </div>
  );
}

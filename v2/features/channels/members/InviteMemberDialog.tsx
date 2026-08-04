'use client';

import { useMemo, useState } from 'react';
import { Loader2, Mail, Search, UserPlus, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { extractApiError } from '@/lib/utils/api-error';
import type { InviteMemberPayload, SlimUser } from '@/types/collab';
import { MemberAvatar } from '../ui/avatars';

/**
 * InviteMemberDialog — invite by picking a space member (added directly by
 * `user_uuid`) or by email, with a role. A v2 port of v1's dialog (study A3
 * KEEP); the caller owns the mutation and this dialog surfaces its failures
 * INLINE (dup → 409, unknown email → 422 — server copy verbatim, no toast).
 * Channel invitees must already be active space members (digest §F.15), so
 * the "In this space" tab is the primary path. Phase-5 W2, 2026-08-04.
 */

export interface InviteCandidate {
  user: SlimUser;
}

type InviteTab = 'people' | 'email';

export function InviteMemberDialog({
  open,
  onOpenChange,
  title,
  description,
  onInvite,
  candidates,
  candidatesLoading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Rejects on failure so this dialog can surface the server line inline. */
  onInvite: (payload: InviteMemberPayload) => Promise<void>;
  candidates: InviteCandidate[];
  candidatesLoading?: boolean;
}) {
  const [tab, setTab] = useState<InviteTab>('people');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [search, setSearch] = useState('');
  const [addingUuid, setAddingUuid] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return candidates;
    return candidates.filter((candidate) =>
      candidate.user.name.toLowerCase().includes(query),
    );
  }, [candidates, search]);

  const reset = () => {
    setTab('people');
    setRole('member');
    setSearch('');
    setAddingUuid(null);
    setPickerError(null);
    setEmail('');
    setEmailError(null);
  };

  const handleAdd = async (userUuid: string) => {
    if (addingUuid) return;
    setAddingUuid(userUuid);
    setPickerError(null);
    try {
      await onInvite({ user_uuid: userUuid, role });
    } catch (error) {
      setPickerError(extractApiError(error).message);
    } finally {
      setAddingUuid(null);
    }
  };

  const handleEmailSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setEmailError(null);
    try {
      await onInvite({ email: trimmed, role });
      reset();
      onOpenChange(false);
    } catch (error) {
      setEmailError(extractApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const roleField = (
    <div className="space-y-2">
      <Label>Role</Label>
      <Select
        value={role}
        onValueChange={(value) => setRole(value as 'admin' | 'member')}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="member">Member</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {(
            [
              { id: 'people', label: 'In this space', icon: Users },
              { id: 'email', label: 'By email', icon: Mail },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'v2-interactive flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
                'transition-colors duration-150 motion-reduce:transition-none',
                tab === id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'people' ? (
          <div className="space-y-4">
            {roleField}

            <div className="space-y-2">
              <div className="relative">
                <Search
                  aria-hidden
                  className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search people in this space"
                  aria-label="Search people in this space"
                  className="pl-8"
                />
              </div>

              <div className="max-h-64 overflow-y-auto rounded-lg border">
                {candidatesLoading ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    <Loader2 aria-hidden className="mr-2 size-4 animate-spin" />
                    Loading members…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {candidates.length === 0
                      ? 'Everyone in this space is already here.'
                      : 'No one matches that search.'}
                    <button
                      type="button"
                      onClick={() => setTab('email')}
                      className="mt-1 block w-full text-primary hover:underline"
                    >
                      Invite someone by email instead
                    </button>
                  </div>
                ) : (
                  <ul className="divide-y">
                    {filtered.map(({ user }) => {
                      const isAdding = addingUuid === user.uuid;
                      return (
                        <li key={user.uuid}>
                          <button
                            type="button"
                            onClick={() => void handleAdd(user.uuid)}
                            disabled={!!addingUuid}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-150 hover:bg-muted/50 disabled:opacity-60 motion-reduce:transition-none"
                          >
                            <MemberAvatar user={user} size="sm" />
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {user.name}
                            </span>
                            {isAdding ? (
                              <Loader2
                                aria-hidden
                                className="size-4 shrink-0 animate-spin text-muted-foreground"
                              />
                            ) : (
                              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                                <UserPlus aria-hidden className="size-3.5" />
                                Add
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {pickerError && (
                <p className="text-sm text-destructive">{pickerError}</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  // IME Enter confirms the composition, never submits (M5).
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void handleEmailSubmit();
                  }
                }}
              />
            </div>
            {roleField}
            {emailError && <p className="text-sm text-destructive">{emailError}</p>}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleEmailSubmit()}
                disabled={submitting || !email.trim()}
              >
                {submitting && <Loader2 aria-hidden className="size-4 animate-spin" />}
                Send invite
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

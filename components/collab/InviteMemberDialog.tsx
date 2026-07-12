'use client';

import { useMemo, useState } from 'react';
import { Loader2, Mail, Search, UserPlus, Users } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import type { InviteMemberPayload, SlimUser } from '@/types/collab';

import { MemberAvatar } from './MemberAvatar';

/** A person who can be added directly (already inside the parent space). */
export interface InviteCandidate {
  user: SlimUser;
}

type InviteTab = 'people' | 'email';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Rejects on failure so the dialog can surface the server message inline. */
  onInvite: (payload: InviteMemberPayload) => Promise<void>;
  /**
   * When provided, unlocks a "pick from this space" tab that adds members by
   * `user_uuid`. Omit it (space / org invites) to keep the email-only form.
   */
  candidates?: InviteCandidate[];
  candidatesLoading?: boolean;
}

/** Invite by picking an existing member, or by email, with a role. */
export function InviteMemberDialog({
  open,
  onOpenChange,
  title,
  description,
  onInvite,
  candidates,
  candidatesLoading = false,
}: InviteMemberDialogProps) {
  const hasPicker = candidates !== undefined;

  const [tab, setTab] = useState<InviteTab>(hasPicker ? 'people' : 'email');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [search, setSearch] = useState('');
  const [addingUuid, setAddingUuid] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = candidates ?? [];
    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter((c) => c.user.name.toLowerCase().includes(query));
  }, [candidates, search]);

  const reset = () => {
    setTab(hasPicker ? 'people' : 'email');
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
    } catch (err) {
      setPickerError(extractApiError(err).message);
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
    } catch (err) {
      setEmailError(extractApiError(err).message);
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
        <SelectTrigger>
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

        {hasPicker && (
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setTab('people')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                tab === 'people'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Users className="h-4 w-4" />
              In this space
            </button>
            <button
              type="button"
              onClick={() => setTab('email')}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                tab === 'email'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Mail className="h-4 w-4" />
              By email
            </button>
          </div>
        )}

        {hasPicker && tab === 'people' ? (
          <div className="space-y-4">
            {roleField}

            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search people in this space"
                  className="pl-8"
                />
              </div>

              <div className="max-h-64 overflow-y-auto rounded-lg border">
                {candidatesLoading ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading members…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {(candidates?.length ?? 0) === 0
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
                            onClick={() => handleAdd(user.uuid)}
                            disabled={!!addingUuid}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
                          >
                            <MemberAvatar user={user} size="sm" />
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {user.name}
                            </span>
                            {isAdding ? (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                            ) : (
                              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                                <UserPlus className="h-3.5 w-3.5" />
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
                autoFocus
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleEmailSubmit();
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
                onClick={handleEmailSubmit}
                disabled={submitting || !email.trim()}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Send invite
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

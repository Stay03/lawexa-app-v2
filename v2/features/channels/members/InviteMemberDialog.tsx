'use client';

import { useMemo, useState } from 'react';
import { Link2, Loader2, Mail, Search, UserPlus, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
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
import { extractApiError } from '@/lib/utils/api-error';
import type { InviteMemberPayload, SlimUser } from '@/types/collab';
import { InviteLinkSection } from '@/v2/features/invites/InviteLinkSection';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { MemberAvatar } from '../ui/avatars';

/**
 * InviteMemberDialog — invite by picking a space member (added directly by
 * `user_uuid`) or by email, with a role. A v2 port of v1's dialog (study A3
 * KEEP); the caller owns the mutation and this dialog surfaces its failures
 * INLINE (dup → 409, unknown email → 422 — server copy verbatim, no toast).
 * Channel invitees must already be active space members (digest §F.15), so
 * the "In this space" tab is the primary path. Phase-5 W2, 2026-08-04.
 *
 * THE PEOPLE ROWS CARRY A HANDLE (2026-08-05). This is a surface where a person
 * is CHOSEN, and a space large enough to need a search box is large enough to
 * hold two people with one name — so the row shows the `@username` that tells
 * them apart, and the search matches it as well as the name. Members with no
 * handle yet keep their row: a handle is what TAGS someone, not what invites
 * them, and this dialog invites.
 */

export interface InviteCandidate {
  user: SlimUser;
}

type InviteTab = 'people' | 'email' | 'link';

export function InviteMemberDialog({
  open,
  onOpenChange,
  title,
  description,
  onInvite,
  candidates,
  candidatesLoading = false,
  linkScope,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Rejects on failure so this dialog can surface the server line inline. */
  onInvite: (payload: InviteMemberPayload) => Promise<void>;
  candidates: InviteCandidate[];
  candidatesLoading?: boolean;
  /**
   * THE THIRD WAY IN, and the only one that reaches somebody with no Lawexa
   * account. Both tabs above it are closed doors to a stranger: the picker
   * lists people who are already in the space, and the email field addresses an
   * account that has to exist. A channel-scoped link makes the space membership
   * and the channel membership in one accept.
   */
  linkScope?: { spaceUuid: string; channelUuid: string; placeName: string };
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
    return candidates.filter(
      ({ user }) =>
        user.name.toLowerCase().includes(query) ||
        // A leading `@` is how people type a handle; matching either way means
        // the search never argues about punctuation.
        (user.username?.includes(query.replace(/^@/, '')) ?? false),
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
    <ResponsiveOverlay
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title={title}
      description={description}
      /* ── ONE FOOTER, CHOSEN BY TAB ────────────────────────────────────
         It used to be three, one inside each tab's branch, which read as
         local until the overlay needed a footer that STAYS while the body
         scrolls. Two of the three were the same button anyway, so lifting
         them out removed a copy as well as a nesting. */
      footer={
        tab === 'email' ? (
          <>
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
          </>
        ) : (
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {/* The strip sizes itself to what is actually offered: a reader with no
            link half must not meet a two-column grid with a hole in it.

            ── AND EVERY PART OF IT IS ALLOWED TO SHRINK (@arthur, 2026-08-11)
            A third column turned this into the widest thing in the dialog on a
            phone, and because a grid track's default `min-width` is `auto` — its
            content's minimum, not zero — the track refused to go below the
            label. The strip pushed the dialog past the screen and took the Copy
            button, the closing words of every sentence and half the third tab
            with it. `min-w-0` on the track is what lets the grid do its job.
            The labels lost their prepositions in the same pass: three of them
            at 393px is not the place for "In this space", which wrapped to two
            lines beside two that did not. */}
        <div
          className={cn(
            'grid gap-1 rounded-lg bg-muted p-1',
            linkScope ? 'grid-cols-3' : 'grid-cols-2',
          )}
        >
          {(
            [
              { id: 'people', label: linkScope ? 'Space' : 'In this space', icon: Users },
              { id: 'email', label: linkScope ? 'Email' : 'By email', icon: Mail },
              ...(linkScope
                ? ([{ id: 'link', label: 'Link', icon: Link2 }] as const)
                : []),
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'v2-interactive flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium whitespace-nowrap',
                'transition-colors duration-150 motion-reduce:transition-none',
                tab === id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
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
                  placeholder="Search by name or @handle"
                  aria-label="Search people in this space by name or handle"
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
                            {/* Same row grammar as the `@` picker: name, then
                                the handle that separates two of them. */}
                            {user.username && (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                @{user.username}
                              </span>
                            )}
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
          </div>
        ) : tab === 'email' ? (
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
          </div>
        ) : (
          /* `linkScope` is what put this tab on the strip, so it is present
             here — but the tab is reachable by state and the narrowing has to
             be real, not assumed. */
          linkScope && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Anyone with this link can ask to join {linkScope.placeName}. They
                do not need a Lawexa account first — signing up is part of it.
              </p>
              <InviteLinkSection
                spaceUuid={linkScope.spaceUuid}
                channelUuid={linkScope.channelUuid}
                framing="standalone"
              />            </div>
          )
        )}
      </div>
    </ResponsiveOverlay>
  );
}

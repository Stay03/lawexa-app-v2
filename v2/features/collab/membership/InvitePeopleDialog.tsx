'use client';

import { useState } from 'react';
import { Loader2, Timer } from 'lucide-react';

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
import type { InviteMemberPayload } from '@/types/collab';
import { InviteLinkSection } from '@/v2/features/invites/InviteLinkSection';

/**
 * InvitePeopleDialog — invite by email, with a role. Shared by the space and
 * organization members sheets; both endpoints take `email` XOR `user_uuid`,
 * and neither has a "people already inside" set to pick from the way a channel
 * does (a channel's invitees must already be space members — digest §F.15 —
 * which is why the channel feature keeps its own picker variant).
 *
 * THE THROTTLE IS ANSWERED QUIETLY (plan W4 item 2). Both invite routes are
 * capped at **30/min**. A 429 is not a fault the inviter made and not a
 * destructive event, so it is NOT painted in red — red stays reserved for
 * failure and destructive actions (design-research DIRECTION 2 / the no-list).
 * It gets a calm timer line and the Send button rests until the field changes,
 * which is the "quiet disable, not an error" shape the research asks for.
 * Every OTHER refusal — duplicate → 409, unknown email → 422 — is shown in the
 * server's own words, inline, because those ARE answers the inviter can act on.
 *
 * The caller owns the mutation and rejects on failure so this dialog can read
 * the reason. Phase-5 W4, 2026-08-04.
 */
export function InvitePeopleDialog({
  open,
  onOpenChange,
  title,
  description,
  onInvite,
  linkScope,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Rejects on failure so the dialog can surface the server line inline. */
  onInvite: (payload: InviteMemberPayload) => Promise<void>;
  /** A SPACE, so it can also offer a link. Organizations pass nothing: invite
   *  links are a spaces feature and there is no organization equivalent. */
  linkScope?: { spaceUuid: string };
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [throttled, setThrottled] = useState(false);

  const reset = () => {
    setEmail('');
    setRole('member');
    setError(null);
    setThrottled(false);
  };

  /**
   * THE ONE CLOSE PATH. Cancel used to call the `onOpenChange` PROP directly,
   * which skips the wrapper below — so the fields, the error line and the
   * throttle rest all survived into the next opening. Every close now goes
   * through here.
   */
  const close = () => {
    reset();
    onOpenChange(false);
  };

  const handleEmailChange = (next: string) => {
    setEmail(next);
    // Editing the address clears the last answer — including the throttle
    // rest, so the reader is never stuck behind a stale disable.
    if (error || throttled) {
      setError(null);
      setThrottled(false);
    }
  };

  const submit = async () => {
    const trimmed = email.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    setThrottled(false);
    try {
      await onInvite({ email: trimmed, role });
      reset();
      onOpenChange(false);
    } catch (failure) {
      const apiError = extractApiError(failure);
      if (apiError.status === 429) {
        setThrottled(true);
      } else {
        setError(apiError.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          close();
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ??
              'They get an invitation they can accept from their own Invitations page.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => handleEmailChange(event.target.value)}
              onKeyDown={(event) => {
                // IME Enter confirms the composition; it must never submit.
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void submit();
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as 'admin' | 'member')}
            >
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin — can invite and manage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* The throttle rest is POLITE, and a polite region has to already
              exist to be announced — inserting one with its text already in
              place is unreliable across screen readers. So the live region is
              permanent and empty until there is something to say, and the
              visible line is its `aria-hidden` twin. Without this the Send
              button simply went quiet for a screen-reader user. */}
          <p role="status" aria-live="polite" className="sr-only">
            {throttled
              ? 'That is a lot of invitations in one minute. Wait a moment and send this one again.'
              : ''}
          </p>
          {throttled && (
            <p
              aria-hidden
              className="flex items-start gap-2 text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
            >
              <Timer aria-hidden className="mt-0.5 size-4 shrink-0" />
              That&rsquo;s a lot of invitations in one minute. Give it a moment and
              send this one again.
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
            >
              {error}
            </p>
          )}

          {/* UNDER the address field, not beside it. Typing an email is the
              thing most people came to do; the link is what they need when the
              person they are inviting has no Lawexa account to address. */}
          {linkScope && <InviteLinkSection spaceUuid={linkScope.spaceUuid} />}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={submitting || throttled || !email.trim()}
          >
            {submitting && <Loader2 aria-hidden className="size-4 animate-spin" />}
            Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

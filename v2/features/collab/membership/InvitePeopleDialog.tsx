'use client';

import { useState } from 'react';
import { Loader2, Timer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { extractApiError } from '@/lib/utils/api-error';
import { InviteLinkSection } from '@/v2/features/invites/InviteLinkSection';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { isInvitableContentRole } from './content-role';
import type { InviteRoleOption } from './invite-roles';
import { RoleSelect } from './RoleSelect';
import {
  INVITE_IDENTIFIER_HINT,
  inviteRefusalMessage,
  parseInviteIdentifier,
  type InviteIdentifier,
} from './invite-identifier';

/**
 * Which identifier the field takes, and so what `onInvite` receives. A space
 * names `email-or-username` and gets either key; an organization names
 * `email` and only ever gets an email.
 */
type InviteeProps<Role extends string> =
  | {
      identifier: 'email';
      /** Rejects on failure so the dialog can surface the server line inline. */
      onInvite: (invite: { invitee: { email: string }; role: Role }) => Promise<void>;
    }
  | {
      identifier: 'email-or-username';
      /** Rejects on failure so the dialog can surface the server line inline. */
      onInvite: (invite: { invitee: InviteIdentifier; role: Role }) => Promise<void>;
    };

/**
 * InvitePeopleDialog — invite by email or username, with a role. Shared by
 * the space and organization members sheets. The space endpoint takes exactly
 * one of `email`, `user_uuid` or `username` (backend 6d11c84); the
 * organization one takes `email` or `user_uuid`. Neither has a "people already inside" set to pick from the way a channel
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
 * An unknown username (422 under `errors.username`) names the handle instead.
 *
 * The caller owns the mutation and rejects on failure so this dialog can read
 * the reason. Phase-5 W4, 2026-08-04.
 *
 * THE ROLES ARE THE CALLER'S (Spaces F7, 12 October 2026). A team space and an
 * organization offer Member and Admin; a SHARED space offers Viewer and
 * Contributor (backend B2). The dialog draws whichever list it is given, opens on
 * its first entry, and hands back the chosen value; the caller turns it into
 * the request (`invitePayload` for spaces), so this file never decides which
 * field a role travels in. On a shared space the link half follows the same
 * choice, so a link made here gives the role the reader picked.
 *
 * THE FIELD IS TOLD WHAT IT TAKES (12 October 2026). `identifier` comes from
 * the caller, never from the text: a space reads "email or @username"
 * (`parseInviteIdentifier`), an organization keeps the email field it had. A
 * value that is neither is caught here and never sent.
 */
export function InvitePeopleDialog<Role extends string>({
  open,
  onOpenChange,
  title,
  description,
  roles,
  identifier,
  onInvite,
  linkScope,
}: InviteeProps<Role> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** The roles to offer, first one selected. Never empty. */
  roles: readonly InviteRoleOption<Role>[];
  /** A SPACE, so it can also offer a link. Organizations pass nothing: invite
   *  links are a spaces feature and there is no organization equivalent.
   *  `contentRoles` (a shared space) makes the link give the chosen role. */
  linkScope?: { spaceUuid: string; contentRoles?: boolean };
}) {
  const defaultRole = roles[0].value;
  const byEmail = identifier === 'email';
  const [value, setValue] = useState('');
  const [role, setRole] = useState<Role>(defaultRole);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [throttled, setThrottled] = useState(false);

  const reset = () => {
    setValue('');
    setRole(defaultRole);
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

  const handleValueChange = (next: string) => {
    setValue(next);
    // Editing the address or handle clears the last answer — including the
    // throttle rest, so the reader is never stuck behind a stale disable.
    if (error || throttled) {
      setError(null);
      setThrottled(false);
    }
  };

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || submitting) return;
    const invitee =
      identifier === 'email' ? { email: trimmed } : parseInviteIdentifier(trimmed);
    if (!invitee) {
      setError(INVITE_IDENTIFIER_HINT);
      return;
    }
    setSubmitting(true);
    setError(null);
    setThrottled(false);
    try {
      await (identifier === 'email'
        ? onInvite({ invitee: { email: trimmed }, role })
        : onInvite({ invitee, role }));
      reset();
      onOpenChange(false);
    } catch (failure) {
      const apiError = extractApiError(failure);
      if (apiError.status === 429) {
        setThrottled(true);
      } else {
        setError(inviteRefusalMessage(apiError, invitee));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          close();
          return;
        }
        onOpenChange(next);
      }}
      title={title}
      description={
        description ??
        'They get an invitation they can accept from their own Invitations page.'
      }
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={submitting || throttled || !value.trim()}
          >
            {submitting && <Loader2 aria-hidden className="size-4 animate-spin" />}
            Send invitation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invite-email">
            {byEmail ? 'Email address' : 'Email or username'}
          </Label>
          <Input
            id="invite-email"
            // A handle is not an email, so a space's field is plain text; the
            // email keyboard still has the `@` a handle starts with.
            type={byEmail ? 'email' : 'text'}
            inputMode={byEmail ? undefined : 'email'}
            autoCapitalize={byEmail ? undefined : 'off'}
            autoComplete="off"
            placeholder={byEmail ? 'name@example.com' : 'name@example.com or @username'}
            value={value}
            onChange={(event) => handleValueChange(event.target.value)}
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
          <RoleSelect id="invite-role" value={role} roles={roles} onChange={setRole} />
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
        {linkScope && (
          <InviteLinkSection
            spaceUuid={linkScope.spaceUuid}
            contentRole={
              linkScope.contentRoles && isInvitableContentRole(role) ? role : undefined
            }
          />
        )}
      </div>
    </ResponsiveOverlay>
  );
}

'use client';

import { Link2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { InviteLink } from '@/types/collab';
import { approvalLabel, CopyLinkButton, inviteUrl } from './link';
import { useCreateInviteLink, useInviteLinks } from './queries';

/**
 * InviteLinkSection — the OTHER half of "Invite people", inside the same
 * dialog as the email field.
 *
 * ── WHY IT IS HERE AND NOT ONLY IN THE ADMIN PANEL ─────────────────────────
 * Links shipped as their own sheet behind the space header's overflow menu.
 * That is the right home for MANAGING them — seeing use counts, killing one —
 * but it is the wrong place to FIND one, because a person who wants to bring
 * somebody in presses "Invite people". They then met a form that could only
 * take an email address, which is the exact door the link feature exists to
 * replace: you cannot type the email of somebody who has never heard of
 * Lawexa. The link now sits under the address field, where the intention
 * already is.
 *
 * ── AND WHY A CHANNEL GETS ONE AT ALL ──────────────────────────────────────
 * A channel's own invite could only ever reach people already in the space
 * (its picker is a space roster, digest §F.15), so there was no way to bring an
 * outsider to one specific channel. `channel_uuid` on the link is that way: it
 * makes the space membership and the channel membership in one accept.
 *
 * ── ONE LINK PER SCOPE, REUSED — NOT A NEW ONE PER PRESS ───────────────────
 * Opening this dialog creates nothing. It reads the space's links and shows the
 * usable one that matches THIS scope, so the space's link and each channel's
 * link are stable addresses somebody can paste twice. A new row is written only
 * when there is no usable one and the reader presses for it.
 *
 * ── IT DISAPPEARS RATHER THAN FAILING ──────────────────────────────────────
 * Listing links is owner/admin only, and a CHANNEL admin need not be a space
 * admin — so this exact dialog can be opened by somebody the links endpoint
 * refuses. A refusal they cannot act on is not worth a red line under a form
 * that otherwise works, so the section simply is not there for them. The email
 * half is unaffected, which is the half they can actually use.
 */

/** The usable link for this scope, or `null`. A channel-scoped dialog wants the
 *  link that names THAT channel; a space-scoped one wants the link that names
 *  no channel at all, never a channel link that would drop people somewhere
 *  they were not invited. */
function linkForScope(
  rows: readonly InviteLink[],
  channelUuid: string | undefined,
): InviteLink | null {
  const match = rows.find(
    (link) =>
      link.is_usable &&
      (channelUuid ? link.channel?.uuid === channelUuid : link.channel === null),
  );
  return match ?? null;
}

export function InviteLinkSection({
  spaceUuid,
  channelUuid,
  /** `section` sits under a form and introduces itself; `standalone` fills a
   *  tab that has already been labelled, so it repeats neither the rule nor the
   *  heading. */
  framing = 'section',
}: {
  spaceUuid: string;
  channelUuid?: string;
  framing?: 'section' | 'standalone';
}) {
  const links = useInviteLinks(spaceUuid);
  const create = useCreateInviteLink(spaceUuid);

  if (links.isError) return null;

  const link = links.data ? linkForScope(links.data.data, channelUuid) : null;

  return (
    <div className={framing === 'section' ? 'space-y-2 border-t pt-4' : 'space-y-2'}>
      {framing === 'section' && (
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium">Or share a link</p>
          <p className="text-xs text-muted-foreground">
            Works for people with no account
          </p>
        </div>
      )}

      {links.isPending ? (
        <Skeleton className="h-9 w-full rounded-lg" />
      ) : link ? (
        <>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-secondary px-2 py-1.5 text-xs">
              {inviteUrl(link.code)}
            </code>
            <CopyLinkButton code={link.code} variant="outline" className="shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground">{approvalLabel(link)}</p>
        </>
      ) : (
        <>
          {/* THE NAME IS NOT IN THE BUTTON, AND THAT IS NOT A STYLE CHOICE.
              A shadcn button is `whitespace-nowrap`, and `DialogContent` is a
              grid whose track sizes to its widest item — so "Make a link to
              #500 Level Sessions with Dieko" set the track 25px wider than the
              dialog's content box, every sibling stretched to match, and the
              Copy button and the ends of three sentences were painted off the
              side of the phone. Measured, not guessed: the button's
              `scrollWidth` was 336 in a 313 box.

              The sentence directly above already names the place, so the button
              never needed to. `min-w-0` and the truncating label stay anyway —
              they are what stops the NEXT long string doing this again. */}
          <Button
            variant="outline"
            className="w-full min-w-0"
            disabled={create.isPending}
            onClick={() =>
              create.mutate({
                requires_approval: true,
                ...(channelUuid ? { channel_uuid: channelUuid } : {}),
              })
            }
          >
            {create.isPending ? (
              <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
            ) : (
              <Link2 aria-hidden className="size-4 shrink-0" />
            )}
            <span className="truncate">Make a link</span>
          </Button>
          {/* Approval is ON, and the sentence says what that MEANS rather than
              naming the flag. Anyone who wants the unattended kind, or a cap or
              an expiry, gets them in the panel that manages links — this half
              exists to produce one good link in one press. */}
          <p className="text-xs text-muted-foreground">
            Anyone using it asks first, and you decide.
          </p>
          {create.isError && (
            <p role="alert" className="text-xs font-medium text-destructive">
              That didn&rsquo;t work. Try again.
            </p>
          )}
        </>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Link2, Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { InviteLink } from '@/types/collab';
import type { InvitableContentRole } from '@/v2/features/collab/membership/content-role';
import { SHARED_INVITE_ROLES } from '@/v2/features/collab/membership/invite-roles';
import { RoleSelect } from '@/v2/features/collab/membership/RoleSelect';
import { inviteLinkPayload } from '@/v2/features/spaces/model';
import { InviteLinkField } from './link';
import {
  useCreateInviteLink,
  useInviteLinks,
  useRevokeInviteLink,
} from './queries';

/**
 * InviteLinksPanel — make a link, see how it is doing, kill it.
 *
 * This is where links are MANAGED. Where they are FOUND is the invite dialog
 * ({@link InviteLinkSection}), which shows the one usable link for its scope
 * beside the email field; the address itself is composed in one place for both
 * (`./link`).
 *
 * ── REVOKE IS NOT DELETE, AND THE UI SAYS SO ───────────────────────────────
 * The server keeps a revoked row so its use count survives. A revoked link is
 * therefore shown, struck through, rather than vanishing — "it stopped working"
 * is a different fact from "it never existed", and an admin wondering why
 * somebody cannot get in deserves the first one.
 *
 * ── APPROVAL IS ON BY DEFAULT, DELIBERATELY ────────────────────────────────
 * The server defaults `requires_approval` to true and this form starts there
 * too. Turning it off means anybody holding the link joins without asking, so
 * the switch says that in plain words rather than naming the flag.
 *
 * ── ONE ADDRESS, SHOWN ONE WAY (design round 1, 12 October 2026) ──────────
 * Each row shows the full address in the same read-only field the invite
 * dialog uses (`InviteLinkField`), with Copy beside it. It used to print a
 * bare `/join/{code}` here while the dialog printed the whole URL, so the same
 * link looked like two different things in two places.
 */

function usesLabel(link: InviteLink): string {
  if (link.max_uses === null) return `${link.uses} used`;
  return `${link.uses} of ${link.max_uses} used`;
}

/**
 * One link row. Split out because the list now renders two groups of them and
 * a dead one must look identical wherever it is shown.
 */
function LinkRow({
  link,
  contentRoles,
  onRevoke,
  revoking,
}: {
  link: InviteLink;
  /** A shared space: say which role the link gives. */
  contentRoles: boolean;
  onRevoke: (id: number) => void;
  revoking: boolean;
}) {
  const dead = !link.is_usable;
  return (
    <li
      className={cn('rounded-xl border border-border/60 p-3', dead && 'opacity-60')}
    >
      <InviteLinkField code={link.code} dead={dead} />

      {/* The row wraps as a whole (design round 2): the facts keep one line and
          Stop link drops under them, right-aligned, when the two do not fit
          side by side. Wrapping inside the facts left "approve" alone on a
          line in the 384px desktop sheet. */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {/* WHICH CHANNEL, WHEN THERE IS ONE. Channel-scoped links are made from
            the invite dialog now, so this list holds two kinds of link whose
            addresses look identical. Without the name an admin cannot tell the
            link that opens the whole space from the one that also drops people
            into a single channel — and those hand out different access. */}
        <p className="min-w-0 text-xs text-muted-foreground">
          {link.channel ? `#${link.channel.name} · ` : ''}
          {contentRoles && link.content_role_label
            ? `${link.content_role_label} · `
            : ''}
          {dead ? 'Stopped working' : usesLabel(link)}
          {link.requires_approval ? ' · you approve' : ' · no approval'}
        </p>
        {dead ? null : (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive"
            disabled={revoking}
            onClick={() => onRevoke(link.id)}
          >
            <Trash2 aria-hidden className="size-4" /> Stop link
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * ON A SHARED SPACE (`contentRoles`; Spaces F7, 12 October 2026) the form also
 * asks which role the link gives, Viewer or Contributor, and each row says it. The
 * request names that role and never a channel (`inviteLinkPayload`; backend B2
 * refuses a channel on a shared space with a 422).
 */
export function InviteLinksPanel({
  spaceUuid,
  contentRoles = false,
}: {
  spaceUuid: string;
  contentRoles?: boolean;
}) {
  const links = useInviteLinks(spaceUuid);
  const create = useCreateInviteLink(spaceUuid);
  const revoke = useRevokeInviteLink(spaceUuid);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [contentRole, setContentRole] = useState<InvitableContentRole>('viewer');
  const [showDead, setShowDead] = useState(false);

  const rows = links.data?.data ?? [];
  /**
   * THE DEAD ONES ARE FOLDED AWAY, AND THIS IS NOT COSMETIC.
   *
   * Revoked rows are kept on purpose — their use counts are the answer to "who
   * got in through what" — but the server returns them mixed in with the live
   * ones, newest first, and a space that has been used for a while is mostly
   * dead links. Watching this panel run against a real space (2026-08-10) it
   * showed six struck-through rows and no live link at all: the reader has to
   * read every row to learn there is nothing to copy. Live first, dead behind
   * one press, and the count is stated so nothing looks deleted.
   */
  const live = rows.filter((link) => link.is_usable);
  const dead = rows.filter((link) => !link.is_usable);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Label htmlFor="invite-approval" className="text-sm font-medium">
              Approve people before they join
            </Label>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {requiresApproval
                ? 'People who use the link join after you approve them.'
                : 'Anyone with the link joins without your approval.'}
            </p>
          </div>
          <Switch
            id="invite-approval"
            checked={requiresApproval}
            onCheckedChange={setRequiresApproval}
          />
        </div>

        {contentRoles ? (
          <div className="mt-4 space-y-2">
            <Label htmlFor="invite-link-role" className="text-sm font-medium">
              People who join get
            </Label>
            <RoleSelect
              id="invite-link-role"
              value={contentRole}
              roles={SHARED_INVITE_ROLES}
              onChange={setContentRole}
            />
          </div>
        ) : null}

        <Button
          className="mt-4 w-full"
          disabled={create.isPending}
          onClick={() =>
            create.mutate(
              inviteLinkPayload(contentRoles ? 'shared' : 'team', {
                requiresApproval,
                contentRole,
              }),
            )
          }
        >
          {create.isPending ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Link2 aria-hidden className="size-4" />
          )}
          Make a link
        </Button>

        {create.isError ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            That didn&rsquo;t work. Try again.
          </p>
        ) : null}
      </div>

      {links.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No links yet. Make one and share it anywhere.
        </p>
      ) : (
        <div className="space-y-3">
          {live.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No link is working right now. Make one above.
            </p>
          ) : (
            <ul className="space-y-3">
              {live.map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  contentRoles={contentRoles}
                  onRevoke={(id) => revoke.mutate(id)}
                  revoking={revoke.isPending}
                />
              ))}
            </ul>
          )}

          {dead.length > 0 && (
            <div className="space-y-3 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center text-muted-foreground"
                onClick={() => setShowDead((open) => !open)}
                aria-expanded={showDead}
              >
                {showDead ? (
                  <ChevronUp aria-hidden className="size-4" />
                ) : (
                  <ChevronDown aria-hidden className="size-4" />
                )}
                {dead.length === 1
                  ? '1 link has stopped working'
                  : `${dead.length} links have stopped working`}
              </Button>
              {showDead && (
                <ul className="space-y-3">
                  {dead.map((link) => (
                    <LinkRow
                      key={link.id}
                      link={link}
                      contentRoles={contentRoles}
                      onRevoke={(id) => revoke.mutate(id)}
                      revoking={revoke.isPending}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

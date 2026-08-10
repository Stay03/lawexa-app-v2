'use client';

import { useState } from 'react';
import { Check, Copy, Link2, Loader2, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { InviteLink } from '@/types/collab';
import {
  useCreateInviteLink,
  useInviteLinks,
  useRevokeInviteLink,
} from './queries';

/**
 * InviteLinksPanel — make a link, see how it is doing, kill it.
 *
 * ── THE LINK IS BUILT HERE, BECAUSE THE SERVER DOES NOT SEND ONE ───────────
 * Measured against production: the row carries `code`, not a URL. So the
 * address is ours to compose, and it is composed from `window.location.origin`
 * rather than a constant — otherwise a link copied on staging points at
 * production and quietly invites somebody into the wrong place.
 *
 * ── REVOKE IS NOT DELETE, AND THE UI SAYS SO ───────────────────────────────
 * The server keeps a revoked row so its use count survives. A revoked link is
 * therefore shown, struck through, rather than vanishing — "it stopped working"
 * is a different fact from "it never existed", and an admin wondering why
 * somebody cannot get in deserves the first one.
 *
 * ── APPROVAL IS ON BY DEFAULT, DELIBERATELY ────────────────────────────────
 * The server defaults `requires_approval` to true and this form starts there
 * too. Turning it off means anybody holding the link walks straight in, so the
 * switch says that in those words rather than naming the flag.
 */

function inviteUrl(code: string): string {
  const origin =
    typeof window === 'undefined' ? 'https://lawexa.com' : window.location.origin;
  return `${origin}/join/${code}`;
}

function usesLabel(link: InviteLink): string {
  if (link.max_uses === null) return `${link.uses} used`;
  return `${link.uses} of ${link.max_uses} used`;
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="shrink-0"
      onClick={() => {
        // Written inside the click, never after an await — a clipboard write
        // that has lost the user gesture is refused on iOS.
        void navigator.clipboard?.writeText(inviteUrl(code));
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? (
        <>
          <Check aria-hidden className="size-4" /> Copied
        </>
      ) : (
        <>
          <Copy aria-hidden className="size-4" /> Copy
        </>
      )}
    </Button>
  );
}

export function InviteLinksPanel({ spaceUuid }: { spaceUuid: string }) {
  const links = useInviteLinks(spaceUuid);
  const create = useCreateInviteLink(spaceUuid);
  const revoke = useRevokeInviteLink(spaceUuid);
  const [requiresApproval, setRequiresApproval] = useState(true);

  const rows = links.data?.data ?? [];

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
                ? 'Anyone using the link asks first, and you decide.'
                : 'Anyone with the link walks straight in, without asking.'}
            </p>
          </div>
          <Switch
            id="invite-approval"
            checked={requiresApproval}
            onCheckedChange={setRequiresApproval}
          />
        </div>

        <Button
          className="mt-4 w-full"
          disabled={create.isPending}
          onClick={() => create.mutate({ requires_approval: requiresApproval })}
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
        <ul className="space-y-3">
          {rows.map((link) => {
            const dead = !link.is_usable;
            return (
              <li
                key={link.id}
                className={cn(
                  'rounded-xl border border-border/60 p-3',
                  dead && 'opacity-60',
                )}
              >
                <div className="flex items-center gap-2">
                  <code
                    className={cn(
                      'min-w-0 flex-1 truncate rounded bg-secondary px-2 py-1 text-xs',
                      dead && 'line-through',
                    )}
                  >
                    /join/{link.code}
                  </code>
                  {dead ? null : <CopyButton code={link.code} />}
                </div>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {dead ? 'Stopped working' : usesLabel(link)}
                    {link.requires_approval ? ' · you approve' : ' · straight in'}
                  </p>
                  {dead ? null : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(link.id)}
                    >
                      <Trash2 aria-hidden className="size-4" /> Stop it
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { InviteLink } from '@/types/collab';

/**
 * The address of an invite, and the one control that copies it.
 *
 * ── THE SERVER DOES NOT SEND A URL ─────────────────────────────────────────
 * Measured against production: the row carries `code` and nothing else, so the
 * address is ours to compose. It is composed from `window.location.origin`
 * rather than a constant, because a link copied on staging that points at
 * production quietly invites somebody into the wrong place.
 *
 * ── AND IT IS COMPOSED IN EXACTLY ONE PLACE ────────────────────────────────
 * Two surfaces now offer a link — the admin panel and the invite dialog — and a
 * second copy of this three-line function is how they start disagreeing about
 * what an invite address looks like. Today's other repair was twelve copies of
 * a two-line ternary.
 */
export function inviteUrl(code: string): string {
  const origin =
    typeof window === 'undefined' ? 'https://lawexa.com' : window.location.origin;
  return `${origin}/join/${code}`;
}

/** How the link behaves, in the reader's terms rather than the flag's. */
export function approvalLabel(link: Pick<InviteLink, 'requires_approval'>): string {
  return link.requires_approval
    ? 'Anyone using it asks first, and you decide.'
    : 'Anyone with it walks straight in.';
}

/**
 * Copy, with its own confirmation.
 *
 * THE CLIPBOARD WRITE HAPPENS INSIDE THE CLICK, never after an `await`: iOS
 * refuses a write that has lost the user gesture, and the failure is silent.
 */
export function CopyLinkButton({
  code,
  variant = 'ghost',
  className,
}: {
  code: string;
  variant?: 'ghost' | 'outline' | 'secondary';
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant={variant}
      size="sm"
      className={className}
      onClick={() => {
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
